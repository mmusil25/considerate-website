# Proposed App Changes (NOT APPLIED)

These are the **prerequisite code changes** that make the app safe to run as a replaceable
container. Per your instruction, **none of these are applied** — this is a written proposal with
exact diffs so you can see the scope before deciding. When you're ready, applying them is a small,
contained PR against `app/`.

Three changes, in priority order. **#1 and #2 are correctness-critical. #3 is an optimization.**

---

## #1 — Media → S3 (CRITICAL)

**Problem.** `app/src/payload.config.ts` defines a `media` upload collection but configures **no
storage adapter**. Payload therefore writes uploads to the container's local disk. The moment a
container is replaced (the entire point of this exercise), every uploaded image is gone. The S3
bucket and CloudFront distribution already exist in `terraform/main.tf` — they're just not wired to
Payload.

**Fix.** Add the official S3 storage plugin so the `media` collection streams uploads to S3.

```bash
# in app/
npm install @payloadcms/storage-s3
```

```diff
# app/src/payload.config.ts
  import { buildConfig } from 'payload'
  import { postgresAdapter } from '@payloadcms/db-postgres'
  import { lexicalEditor } from '@payloadcms/richtext-lexical'
+ import { s3Storage } from '@payloadcms/storage-s3'
  import path from 'path'
  import { fileURLToPath } from 'url'
  import Projects from './collections/Projects.ts'

  const filename = fileURLToPath(import.meta.url)
  const dirname = path.dirname(filename)

  export default buildConfig({
    admin: {
      user: 'users',
    },
    editor: lexicalEditor(),
    collections: [
      { slug: 'users', auth: true, fields: [{ name: 'name', type: 'text' }] },
      { slug: 'media', upload: true, fields: [] },
      Projects,
    ],
    db: postgresAdapter({
      pool: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      },
    }),
+   plugins: [
+     s3Storage({
+       collections: {
+         // route the `media` collection's files to S3 instead of local disk
+         media: {
+           // prefix lets many sites share one bucket: e.g. "markmusil/", "bakery/"
+           prefix: process.env.S3_PREFIX || '',
+         },
+       },
+       bucket: process.env.S3_BUCKET || '',
+       config: {
+         region: process.env.AWS_REGION || 'us-east-2',
+         // In AWS, prefer an IAM task role over static keys. These envs are the
+         // fallback for local dev (MinIO) and non-AWS environments.
+         ...(process.env.AWS_ACCESS_KEY_ID && {
+           credentials: {
+             accessKeyId: process.env.AWS_ACCESS_KEY_ID,
+             secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
+           },
+         }),
+         // endpoint + forcePathStyle let the SAME code talk to MinIO locally
+         ...(process.env.S3_ENDPOINT && {
+           endpoint: process.env.S3_ENDPOINT,
+           forcePathStyle: true,
+         }),
+       },
+     }),
+   ],
    secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
    typescript: {
      outputFile: path.resolve(dirname, '../payload-types.ts'),
    },
  })
```

**Why the `prefix` matters for the platform:** it's how many sites share one bucket cleanly in
Model A (see `ARCHITECTURE.md` §3). Each site sets `S3_PREFIX=<site>/` and their media never collide.

**Migration note for the existing site:** any images already uploaded to the live EC2's local disk
must be copied into S3 once (`aws s3 cp --recursive` from the old `media` dir), or they'll 404 after
cutover. One-time task, documented at cutover.

---

## #2 — Stable `PAYLOAD_SECRET` (CRITICAL)

**Problem.** `terraform/init.sh` line ~25 sets `PAYLOAD_SECRET=$(openssl rand -base64 32)` — a
**new random secret on every boot**. `PAYLOAD_SECRET` is used to sign JWT sessions and encrypt
secured fields. If it changes when a container/box is replaced:
- every logged-in admin session is invalidated, and
- any encrypted field value becomes undecryptable (data loss).

For "new container = same site," the secret **must be identical** across every container of a site
and stable over time.

**Fix.** Remove secret generation from boot-time scripting. Provision one secret **per site**, store
it in **AWS Secrets Manager**, and inject it as an env var into the container. No code change in
`payload.config.ts` is needed (it already reads `process.env.PAYLOAD_SECRET`) — the change is
operational:

```diff
# terraform/init.sh  (current bake-on-boot path — to be retired in Phase 2/3)
- PAYLOAD_SECRET=$(openssl rand -base64 32)
+ # PAYLOAD_SECRET must be stable per-site. Source it from Secrets Manager, e.g.:
+ # PAYLOAD_SECRET=$(aws secretsmanager get-secret-value \
+ #   --secret-id considerate/<site>/payload-secret --query SecretString --output text)
```

In the ECS/Fargate target, this is even cleaner: the task definition references the Secrets Manager
ARN and ECS injects it — the secret never appears in code, logs, or the image.

> ⚠️ The **already-running** site likely has a secret that changed on its last boot. When we cut it
> over, we pin whatever its *current* secret is (or accept a one-time admin re-login). Worth checking
> the live box's `app/.env` before cutover so we don't silently rotate it.

---

## #3 — `output: 'standalone'` in Next config (optimization)

**Problem.** Without standalone output, the production image must carry the full `node_modules`
(~1 GB+), making images slow to build, push, and pull — which hurts a platform that pulls images
across many sites/deploys.

**Fix.** One line in `app/next.config.mjs`:

```diff
# app/next.config.mjs
  import { withPayload } from '@payloadcms/next/withPayload'

  /** @type {import('next').NextConfig} */
  const nextConfig = {
+   output: 'standalone',
    images: {
      remotePatterns: [
        { hostname: 'cdn.builder.io' },
+       // add the site's CloudFront domain so Next can optimize S3-hosted media:
+       // { hostname: 'd23c3aaj86r78z.cloudfront.net' },
      ],
    },
  }

  export default withPayload(nextConfig)
```

**Two caveats the Dockerfile already accounts for:**
- **`sharp`** (image processing) ships native binaries. The `Dockerfile` runner stage installs
  `sharp` explicitly so standalone tracing doesn't drop it.
- **Migrations CLI.** The `payload` CLI isn't part of the standalone server bundle. The
  `docker-entrypoint.sh` handles running migrations; see its comments for the production pattern
  (a dedicated one-off migration task) vs. the simple entrypoint approach.

---

## Summary

| # | Change | File(s) | Risk if skipped |
|---|---|---|---|
| 1 | Media → S3 via `@payloadcms/storage-s3` | `app/src/payload.config.ts`, `app/package.json` | **Uploads lost on every container replace** |
| 2 | Stable `PAYLOAD_SECRET` from Secrets Manager | `terraform/init.sh` + ECS task def (operational) | **Sessions/encrypted data break on replace** |
| 3 | `output: 'standalone'` | `app/next.config.mjs` | Bloated, slow images (works, just heavy) |

Applying #1 + #2 is worthwhile **even if you never containerize** — they make the *current* EC2 site
disaster-resilient. That's a good reason to do them first, independently, low-risk.
