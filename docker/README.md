# Docker Deployment — Groundwork & Design

> **Status: design + reference scaffolding. Nothing here changes the live app or infra yet.**
> This folder exists to answer one question: *what would it take to run `considerate-website`
> as a Docker image so that the same Payload + Builder.io pattern can spin up any number of
> similar sites, where a new site/version = a new container, with backups we can restore?*
>
> Read this top-to-bottom. Then look at [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the
> platform-level design and [`PROPOSED_APP_CHANGES.md`](./PROPOSED_APP_CHANGES.md) for the
> three code changes the app needs before any of this works.

---

## 1. The goal (in your words, made concrete)

You want a **build pattern**, not a one-off website. Specifically:

1. **One reusable template** — the Payload CMS + Next.js + Builder.io stack in `app/` — that
   can produce *many* similar sites.
2. **New site / new version = new container.** Each site (or each version of a site) is an
   immutable, independently deployable artifact.
3. **Backups you can actually restore.** Both the database (content) and the media (uploads)
   must be recoverable to a known-good point in time.
4. **Long-term: a hosting platform on AWS** that turns "I want another site like this" into a
   repeatable, mostly-automated operation.

Docker is the right first brick because it makes the app a **portable, versioned artifact**.
Today the app is "baked onto a server at boot." That's the thing standing between you and the
platform. This folder is about replacing *bake-on-boot* with *build-an-image-once, run-anywhere*.

---

## 2. Where you are today (honest snapshot)

I read the whole repo before designing this. Here's the real current architecture:

```
Builder.io (visual pages, hosted by builder.io)
        │  @builder.io/react SDK in the Next app
        ▼
EC2 instance (Ubuntu)                          ← single "pet" server
  ├─ nginx :80  ──►  Next.js/Payload :3000      ← started by PM2
  ├─ app code = `git clone` at boot (init.sh)
  └─ media uploads written to LOCAL DISK         ← ⚠️ problem (see §4)
        │
        ▼
RDS PostgreSQL 15 (private subnet)             ← content lives here
S3 bucket + CloudFront                         ← exists, but Payload doesn't use it for media
```

**How a deploy works now** (`terraform/init.sh`, runs as EC2 user-data):
`apt install node/nginx` → `git clone` the repo → write `.env` → `npm install` →
`payload generate:importmap` → `npm run build` → `payload migrate` → `pm2 start`.

This works, but it has properties that fight the goal:

| Property today | Why it blocks the platform goal |
|---|---|
| App is assembled **on the server at boot** | Two servers can build slightly different things; no single versioned artifact to promote or roll back. |
| **One server per site** is a hand-managed pet | "Any number of sites" means a lot of pets. Doesn't scale operationally. |
| Media uploads land on **local disk** | If the server is replaced (which is the *whole point* of containers), uploaded images vanish. |
| `PAYLOAD_SECRET` is **regenerated every boot** (`openssl rand`) | Restarting/replacing the box invalidates sessions and breaks any encrypted fields. Fatal for "new container = same site." |
| Deploy = SSH + `git pull` + rebuild | Not reproducible, not auditable, hard to automate across many sites. |

None of this is "wrong" for a single portfolio site — it's a perfectly good v1. It just isn't a
*platform*. The good news: the bones (RDS, S3, CloudFront, Terraform, committed migrations) are
already platform-shaped. We're mostly re-plumbing how the **app** is packaged and where **state** lives.

---

## 3. The mental model shift

Three ideas carry the whole design:

**(a) Pets → cattle.** Today the EC2 box is a *pet*: named, hand-fed, irreplaceable (its disk
holds your media). In the target, app containers are *cattle*: identical, disposable, replaceable
at will — because they hold **no state**. All state moves to managed services (RDS for content,
S3 for media).

**(b) Bake-on-boot → immutable image.** Instead of building the app on the server, we build it
**once** into a Docker image tagged with the git commit (e.g. `considerate-web:9442a99`). That exact
image is what runs in dev, staging, and prod. "It worked on my machine" stops being a sentence.

**(c) One image, many sites — config is the only difference.** The same image becomes
`mark-portfolio`, `client-bakery`, `client-law-firm`, etc. purely by changing **environment
variables and content at runtime**:

```
                       ┌─────────────────────────────┐
                       │  considerate-web:<git-sha>   │   ← ONE image (the template)
                       └─────────────┬───────────────┘
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
   env: DATABASE_URL=db-A    env: DATABASE_URL=db-B    env: DATABASE_URL=db-C
        S3_BUCKET=site-A          S3_BUCKET=site-B          S3_BUCKET=site-C
        PAYLOAD_SECRET=…A         PAYLOAD_SECRET=…B         PAYLOAD_SECRET=…C
        BUILDER_API_KEY=…A        BUILDER_API_KEY=…B        BUILDER_API_KEY=…C
            ▼                        ▼                        ▼
      site A container          site B container          site C container
      (Mark's portfolio)        (bakery client)           (law firm client)
```

So **"new site = new container with new env + new database + new bucket."** And **"new version of a
site = new image tag, same env, rolled out to that site's container(s)."** That's the entire
operating model, and it's exactly what you described.

---

## 4. The three things the app MUST change first

Containerization is blocked on three app-level changes. They are **not applied** here (you said
don't change what's there yet) — they're written up with exact diffs in
[`PROPOSED_APP_CHANGES.md`](./PROPOSED_APP_CHANGES.md). Summary:

1. **Media → S3** (the big one). Add `@payloadcms/storage-s3` to `payload.config.ts` so the `media`
   collection writes to the S3 bucket instead of local disk. Without this, every container
   replacement loses uploaded images. This is the single most important prerequisite.

2. **Stable `PAYLOAD_SECRET`.** Stop generating it per-boot. It must be a fixed secret per site
   (injected from AWS Secrets Manager / env), identical across every container for that site, or
   logins and encrypted fields break on restart.

3. **`output: 'standalone'` in `next.config.mjs`.** Lets Next emit a self-contained server bundle so
   the Docker image is ~150 MB instead of dragging the full `node_modules` (~1 GB+). Optional for
   correctness, important for a lean, fast-to-pull platform image.

> Until #1 and #2 are done, a container *runs* but is not *safe to replace* — which defeats the
> purpose. Treat them as hard prerequisites; #3 is an optimization.

---

## 5. What's in this folder

| File | What it is |
|---|---|
| `README.md` | This document — the why and the model. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Deep dive: multi-site strategy, versioning/rollback, the full AWS platform roadmap (phases), and the backup/restore design. |
| [`PROPOSED_APP_CHANGES.md`](./PROPOSED_APP_CHANGES.md) | The exact, unapplied code changes from §4, with diffs. |
| `Dockerfile` | Reference multi-stage build for the Payload/Next app. Heavily commented. **Not built/tested yet** — depends on the §4 changes. |
| `docker-compose.yml` | Local dev stack: app + Postgres + MinIO (S3 emulator). Lets you run the whole thing on your laptop with one command. |
| `docker-entrypoint.sh` | Container startup: run DB migrations, then start the server. |
| `.dockerignore` | Keeps build context small/clean. |
| `.env.example` | Full inventory of every environment variable a site needs. |

---

## 6. Local quickstart (once the §4 changes land)

This is the payoff — the whole stack on your laptop, no AWS needed:

```bash
cd docker
cp .env.example .env          # fill in PAYLOAD_SECRET etc. (dev values are fine)
docker compose up --build
# → Postgres on :5432, MinIO (fake S3) on :9000/:9001, app on http://localhost:3000
# → admin at http://localhost:3000/admin
```

MinIO stands in for S3 locally, so the *exact same* media-upload code path you'll use in
production also works on your laptop. Dev/prod parity, for free.

---

## 7. Cost sketch (rough, us-east-2)

Per site, the marginal cost is mostly the database:

- **Shared model (recommended to start):** all sites share one RDS instance (separate databases or
  schemas) and one ECS cluster. Marginal cost of site N ≈ **a few $/month** (its slice of compute +
  its S3 usage). Base platform ≈ **$40–70/mo** (one `db.t3.micro` RDS + small Fargate + S3/CF).
- **Isolated model (per-client production):** each site gets its own RDS + bucket ≈ **$25–35/mo per
  site**. Use this only when a client needs hard isolation.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §multi-tenancy for the trade-offs.

---

## 8. Open questions for you

These decisions shape the platform; flagging them now so we design once:

1. **Isolation:** shared RDS (cheap, simple) vs. one RDS per site (isolated, pricier)? I recommend
   *shared to start, isolated as a per-client upgrade.*
2. **Runtime:** ECS Fargate (serverless containers, least ops) vs. ECS-on-EC2 (cheaper at scale) vs.
   plain Docker on the existing EC2 (smallest leap from today)? I recommend *Fargate* for the
   platform, but we can prove it on the current EC2 first.
3. **Custom domains:** will each site have its own domain (needs ACM cert + ALB host routing per
   site)? Affects the networking layer.
4. **Who creates sites:** just you via CLI, or eventually a self-serve flow? Changes how much
   automation we build vs. buy.

No need to answer now — these live at the bottom of `ARCHITECTURE.md` too.
