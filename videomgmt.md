# Video Management & Adaptive Streaming

How this site hosts very high quality video (4K60, any source codec) and plays it
back fast on the project pages. Built as a client-impressing demo: **near-instant
start on broadband**, adaptive quality, and a quality policy that **preserves the
source ceiling and only adapts down when a client or network can't keep up.**

---

## TL;DR

- You upload an original video in the Payload admin (a **Videos** record). The file
  goes **straight from your browser to S3** (multipart, presigned) — it never passes
  through the app server, so multi-GB 4K files don't choke it.
- That upload triggers a **MediaConvert** job (via a Lambda) that produces an
  **adaptive HLS ladder** using **Automated ABR** — the ladder is built *from the
  source down*, never upscaled, capped at 2160p, framerate following the source.
- When transcoding finishes, a webhook flips the record to **Ready**.
- On a project page, attach the video and a **player** streams it: HLS by default
  (instant start, adapts), with an optional **"Max quality (original)"** path for
  browsers that can decode the source directly (preserves Opus/VP9, etc.).

---

## Architecture

```
   ADMIN (your browser)                    APP  (ECS/Fargate · Next.js + Payload)
   ┌──────────────────┐  1. presign parts  ┌──────────────────────────────────┐
   │  VideoUploader    │ ─────────────────▶ │  POST /api/videos/upload/create   │
   │  (custom field)   │                    │       …/sign-part  …/complete     │
   │                   │ ◀───────────────── │  (auth'd via Payload session)     │
   └────────┬──────────┘  presigned URLs    └──────────────────────────────────┘
            │ 2. PUT parts directly to S3 (bypasses the server)
            ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ S3  considerate-site-assets-<acct>                                          │
   │     videos/source/<id>/<file>        ← your original (archived)             │
   │     videos/hls/<id>/index.m3u8       ← master manifest  ┐                   │
   │     videos/hls/<id>/index_*.m3u8     ← variant playlists ├ written by       │
   │     videos/hls/<id>/*.ts             ← segments          │ MediaConvert     │
   │     videos/hls/<id>/poster.*.jpg     ← poster frame      ┘                   │
   └───────┬───────────────────────────────────────────────▲────────────────────┘
           │ 3. ObjectCreated(videos/source/)               │ 5. writes HLS ladder
           ▼                                                │
   ┌────────────────┐  4. CreateJob (Automated ABR) ┌───────┴────────┐
   │  LAMBDA         │ ────────────────────────────▶ │  MediaConvert  │
   │  video-pipeline │                               └───────┬────────┘
   └──────▲─────────┘  6. "Job State Change" (EventBridge)   │
          │ ◀──────────────────────────────────────────────-┘
          │ 7. POST /api/videos/transcode-callback  (x-webhook-secret)
          ▼
   ┌────────────────────────────────────┐   status → ready | error
   │  APP webhook → update Video doc     │   sets hlsManifestKey, posterKey
   └────────────────────────────────────┘

   PLAYBACK
   project page ─▶ <VideoPlayer> ─▶ CloudFront ─▶ S3  (videos/hls/<id>/…)
                     │                     (CORS enabled, OPTIONS allowed,
                     │                      Origin forwarded for hls.js)
                     ├─ Safari/iOS : native HLS  (<video src=manifest>)
                     ├─ others     : hls.js attaches the manifest
                     └─ "Max quality": streams the archived original directly
                                       (only if the browser can decode its codecs)
```

---

## The quality policy (why it's built this way)

> Encode from the source **downward, never upward.** Only downgrade when the client
> or network requires it.

- **MediaConvert Automated ABR** inspects the source and generates an optimal ABR
  ladder. It never produces a rendition larger than the source, so a 1080p/30 phone
  clip tops out at 1080p/30 and a 4K60 clip tops out at 4K60 (ceiling 2160p via
  `MaxAbrBitrate`). Framerate follows the source.
- **Audio** in the HLS renditions is **AAC** — this is the *only* place quality is
  intentionally bounded, and only because **HLS can't carry Opus to Safari/iOS**. It
  is the compatibility fallback, never the ceiling.
- The **original file is archived** at `videos/source/<id>/…` and can be played
  **directly** by browsers that support its codecs (Chrome/Firefox/Edge for
  Opus/VP9, etc.). The player exposes a **"Max quality (original)"** toggle when the
  browser reports it `canPlayType(...) === 'probably'`.

Net effect: capable clients on broadband converge to source-equivalent quality
within a rung or two (or play the original outright); weak clients/networks step
down gracefully.

---

## Components

### App (Next.js + Payload) — `app/`
| Path | Role |
|---|---|
| `src/collections/Videos.ts` | The Videos record: keys + transcode state. NOT a Payload `upload` collection. |
| `src/collections/Projects.ts` | Adds `projectVideo` relationship (the "input field" on a project). |
| `src/components/payload/VideoUploader.tsx` | Admin field: drag-drop → direct-to-S3 multipart → polls status. |
| `src/components/VideoPlayer.tsx` | Frontend player: hls.js + native HLS + original-ceiling toggle. |
| `src/lib/s3-upload.ts` | S3 client + multipart helpers (create / sign-part / complete / abort). |
| `src/lib/cdn.ts` | `cdnUrl(key)` → CloudFront URL (falls back to S3/MinIO locally). |
| `src/app/api/videos/upload/create/route.ts` | Begins multipart upload for a saved Video. |
| `src/app/api/videos/upload/sign-part/route.ts` | Presigns one part URL (key restricted to `videos/source/`). |
| `src/app/api/videos/upload/complete/route.ts` | Completes upload; marks `processing` (prod) or `ready` (local). |
| `src/app/api/videos/transcode-callback/route.ts` | Secret-gated webhook the Lambda calls on job completion. |

### Infra (Terraform) — `terraform/`
| Resource | Role |
|---|---|
| `aws_s3_bucket_cors_configuration.assets` | Allows browser PUT (upload) + hls.js GET; exposes `ETag`. |
| `ordered_cache_behavior "videos/hls/*"` (CloudFront) | OPTIONS + Origin forwarding + CORS response headers for HLS. |
| `aws_iam_role.mediaconvert` | MediaConvert service role (read source, write HLS). |
| `aws_iam_role.video_lambda` (+ policy) | Lambda perms: logs, `mediaconvert:CreateJob`, `iam:PassRole`, read source. |
| `aws_lambda_function.video_pipeline` | The pipeline brain (zipped from `terraform/lambda/`). |
| `aws_s3_bucket_notification.assets` | `videos/source/` ObjectCreated → Lambda. |
| `aws_cloudwatch_event_rule.mediaconvert_complete` | MediaConvert COMPLETE/ERROR → Lambda. |
| `random_password.webhook_secret` | Shared secret injected into BOTH the Lambda and the ECS task. |
| ECS task role + task env | Adds multipart S3 actions; injects `CLOUDFRONT_DOMAIN`, prefixes, `WEBHOOK_SECRET`. |

### Lambda — `terraform/lambda/index.mjs`
One function, two triggers (routes by event shape), using the runtime's built-in
`@aws-sdk` and global `fetch`:
- **S3 event** → parse `<id>` from the key → `HeadObject` the source to read the
  `removeaudio` user-metadata flag → `CreateJob` (Automated ABR HLS + poster
  frame-capture; **no audio track when `removeaudio=true`**), echoing
  `{videoId, hlsKey, posterKey}` in `UserMetadata`.
- **MediaConvert "Job State Change"** → on COMPLETE/ERROR, POST the app webhook with
  the secret so the Video doc flips to `ready`/`error`.

### Remove audio (silent video)
A `removeAudio` checkbox on the Video doc lets the editor drop the soundtrack —
for workshop clips where the only audio is fan/background noise. Set it **before
uploading**: `VideoUploader` sends the flag to `/api/videos/upload/create`, which
stamps it as **S3 object metadata** (`x-amz-meta-removeaudio: true`) on the source.
The Lambda HeadObjects the source and builds a job with no `AudioSelectors` /
`AudioDescriptions`, so the HLS renditions are silent. To change it on an existing
clip, re-upload the source. (No effect locally — local mode does no transcode and
plays the source, which still has its audio.)

---

## Environment variables

| Var | Where | Meaning |
|---|---|---|
| `CLOUDFRONT_DOMAIN` | app | CDN domain for playback URLs. **Blank locally** → falls back to S3/MinIO and the upload-complete route marks videos `ready` (no transcode). |
| `VIDEO_SOURCE_PREFIX` | app | `videos/source/` — where originals land. |
| `VIDEO_HLS_PREFIX` | app | `videos/hls/` — where HLS output lives. |
| `WEBHOOK_SECRET` | app + Lambda | Shared secret for the completion webhook. Prod value from `random_password`. |
| `MEDIACONVERT_ROLE_ARN` | Lambda | Role MediaConvert assumes (passed via `iam:PassRole`). |
| `MEDIACONVERT_QUEUE` | Lambda | Default on-demand queue ARN. |
| `ASSETS_BUCKET`, `HLS_PREFIX`, `APP_WEBHOOK_URL` | Lambda | Bucket + output prefix + webhook endpoint. |

---

## Deploy / runbook

### First-time / infra changes
```sh
cd terraform
terraform init          # picks up the new archive provider
terraform plan          # review: CORS, MediaConvert role, Lambda, triggers, CloudFront behavior
terraform apply
terraform output -json > ../outputs.json
```
`terraform apply` zips `terraform/lambda/` into `terraform/.build/video-lambda.zip`
automatically (the `archive_file` data source) — no separate Lambda build step.

### App schema migration (needs your input — see note below)
The Videos table + `projects.project_video` column (plus the earlier schema.org
fields) are not yet captured in a migration. Generate one:
```sh
cd app
npx payload migrate:create add_videos_and_seo
```
> ⚠️ **Interactive prompt:** drizzle will ask whether `technologies.tech` →
> `tech_id` is a **rename** or a **new column**. Choose **create column** (it is a
> type change, not a rename) — the same choice made in dev. Everything else is a
> pure addition and won't prompt.

Then deploy and run migrations the usual way (the `:migrator` task / `RUN_MIGRATIONS`).

### Redeploy just the Lambda
Edit `terraform/lambda/index.mjs`, then `terraform apply` — the `source_code_hash`
changes and the function updates. Tail logs:
```sh
aws logs tail "/aws/lambda/$(terraform -chdir=terraform output -raw video_pipeline_lambda)" --follow
```

### Re-trigger a transcode for an existing source
Re-emit the S3 event by copying the object onto itself, or just re-upload. To debug
a stuck job, open the **MediaConvert** console (region us-east-2) and inspect the
job; `mediaConvertJobId` is stored on the Video doc.

---

## Local development

MinIO + local Postgres are up via `docker compose`, but there is **no CloudFront,
Lambda, or MediaConvert locally**. So:
- Uploads still go direct-to-(MinIO-)S3 via the same presigned multipart flow.
- `upload/complete` sees no `CLOUDFRONT_DOMAIN` and marks the video **Ready**
  immediately with **no HLS**.
- `VideoPlayer` then plays the **source file directly** (works for browser-friendly
  formats like H.264/AAC MP4; exotic source codecs may not play locally).

This is enough to exercise the upload UX and player end-to-end without AWS.

---

## Costs & risks

- **MediaConvert** bills per output-minute across the ladder; 4K60 is the priciest
  tier. Automated ABR caps rungs at the source, so a 1080p phone clip never pays for
  4K outputs it doesn't warrant.
- **CloudFront egress** on large segments — mitigated by caching + ABR (most clients
  never pull the top rung).
- **Codec reality:** Opus can't traverse HLS to Safari/iOS; it survives in the
  archived original (and direct playback where supported). HLS audio is AAC.
- **Webhook** is public but **secret-gated**; rotate `WEBHOOK_SECRET` by tainting
  `random_password.webhook_secret` and re-applying (updates both Lambda and app).
- **Poster filename** is predicted as `poster.0000000.jpg` from MediaConvert frame
  capture; if a future MediaConvert change alters the suffix, the poster simply
  won't resolve (player still works). Adjust in the Lambda + callback if needed.
- **CI/CD:** the Lambda currently deploys via Terraform's `archive_file`. A proper
  CI/CD pipeline (build, test, push, plan/apply) is the natural next iteration.

---

## Encode tuning

The HLS ladder is plain JSON in `terraform/lambda/index.mjs` (`buildJobSettings`).
Knobs you'll most likely touch:
- `AbrSettings.MaxAbrBitrate` — ceiling bitrate (≈ top resolution).
- `AbrSettings.MaxRenditions` / `MinAbrBitrate` — ladder breadth / floor.
- `HlsGroupSettings.SegmentLength` — segment seconds (smaller = faster start, more
  requests).
- `AacSettings.Bitrate` — HLS audio bitrate.

Change, `terraform apply`, re-upload a test clip, validate in the MediaConvert
console and with browser playback.
