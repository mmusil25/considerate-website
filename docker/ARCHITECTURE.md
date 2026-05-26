# Architecture — Containerized Multi-Site Platform

This is the deep dive behind [`README.md`](./README.md). It covers the target architecture, how one
image serves many sites, how versioning/rollback works, the backup & restore design, and a phased
roadmap from "today's single EC2" to "a real AWS hosting platform."

---

## 1. Target architecture (the platform)

```
                                   ┌──────────────────────┐
   GitHub push ──► CI (Actions) ──►│  Build & push image  │──► ECR: considerate-web:<git-sha>
                                   └──────────────────────┘         (one image = the template)
                                                                          │
   ┌──────────────────────────────────────────────────────────────────── │ ─────────────────┐
   │ AWS                                                                   ▼                   │
   │                          ┌───────────────────────────────────────────────────┐          │
   │   Route53 / ACM          │              ECS cluster (Fargate)                 │          │
   │      │                   │                                                    │          │
   │      ▼                   │   ┌─ service: site-A ─┐  ┌─ service: site-B ─┐      │          │
   │   ALB (host routing) ───►│   │ task: web:<sha>   │  │ task: web:<sha>   │ ...  │          │
   │   markmusil.com → A      │   │ env: DB=A,S3=A    │  │ env: DB=B,S3=B    │      │          │
   │   bakery.com   → B       │   └─────────┬─────────┘  └─────────┬─────────┘      │          │
   │                          └─────────────┼──────────────────────┼───────────────┘          │
   │                                        ▼                       ▼                          │
   │                            ┌───────────────────────────────────────────┐                 │
   │                            │  RDS PostgreSQL   (db_A, db_B, … )         │  ← content      │
   │                            └───────────────────────────────────────────┘                 │
   │                            ┌───────────────────────────────────────────┐                 │
   │  CloudFront ◄──────────────│  S3   (bucket/site-A/…, bucket/site-B/…)   │  ← media        │
   │                            └───────────────────────────────────────────┘                 │
   │                            ┌───────────────────────────────────────────┐                 │
   │                            │  Secrets Manager (PAYLOAD_SECRET, DB creds)│  ← secrets      │
   │                            └───────────────────────────────────────────┘                 │
   └─────────────────────────────────────────────────────────────────────────────────────────┘

   Builder.io (external SaaS) ──► visual page content pulled at request/build time via @builder.io/react
```

Key principle: **the app container is stateless.** Everything that must survive a container being
killed lives in a managed service — content in RDS, media in S3, secrets in Secrets Manager. That's
what makes "new version = new container" safe.

---

## 2. Anatomy of the image (the template)

The Dockerfile builds **one** image from `app/`. It is multi-stage:

1. **deps** — `npm ci` to get a clean, lockfile-exact dependency tree.
2. **builder** — copy source, run `payload generate:importmap` then `next build`. With
   `output: 'standalone'` (see `PROPOSED_APP_CHANGES.md`), Next emits a self-contained server in
   `.next/standalone`.
3. **runner** — a slim `node:22-slim` image containing only the standalone server, static assets,
   `public/`, and the migration tooling. Runs as a non-root user.

The image contains **no secrets and no site identity.** Identity is injected at runtime via env.
That's the whole trick that lets it be reused across sites.

### What's baked in vs injected

| Baked into the image (same for all sites) | Injected at runtime (per site) |
|---|---|
| App code, Next build, Payload config | `DATABASE_URL` (which DB / which site's content) |
| Collections schema, migrations | `PAYLOAD_SECRET` (per-site, stable, from Secrets Manager) |
| Builder.io rendering components | `S3_BUCKET` / `S3_PREFIX` (which media lives where) |
| Dependencies (React, sharp, etc.) | `BUILDER_API_KEY` (which Builder.io space) |
|  | `PAYLOAD_PUBLIC_SERVER_URL` (the site's public URL) |

---

## 3. Multi-tenancy: how "any number of similar sites" works

Three models, increasingly isolated. You can mix them per-site.

### Model A — Shared everything (cheapest, best to start)
- One RDS instance, **one database per site** (`payload_markmusil`, `payload_bakery`, …).
- One S3 bucket, **one prefix per site** (`s3://assets/markmusil/`, `s3://assets/bakery/`).
- One ECS cluster, one service per site.
- **Pros:** marginal cost of a new site ≈ a few $/mo. Fast to stand up.
- **Cons:** shared blast radius (a runaway query on the RDS box affects neighbors). Fine for your
  own sites + small clients.

### Model B — Shared compute, isolated data
- Separate RDS instance **per site** (or per important client), shared ECS cluster.
- Separate S3 bucket per site.
- **Pros:** real data isolation; per-client backup/restore is independent; easy to hand a client
  their own DB. **Cons:** ~$25–35/mo floor per site (the RDS instance).

### Model C — Fully isolated
- Separate everything, possibly separate AWS account per client (via AWS Organizations).
- For enterprise/compliance clients only.

**Recommendation:** start at **A**, design the automation so promoting a site to **B** is a config
flag, not a rewrite. The Terraform module in the roadmap (§6) is built around "a site = a set of
variables," which makes A↔B a per-site choice.

> Note: this is **infrastructure** multi-tenancy (one site = one isolated deployment), *not*
> application-level multi-tenancy (one Payload instance serving many tenants). Infra-level is simpler,
> safer, and matches "new site = new container." Payload *can* do app-level multi-tenancy with a
> plugin, but that couples sites together and isn't what you want for a hosting platform.

---

## 4. Versioning & rollback ("new version = new container")

Images are tagged immutably by git commit, with moving tags layered on top:

```
considerate-web:9442a99      ← immutable, the exact commit (never reused)
considerate-web:v1.4.0       ← human-friendly release tag
considerate-web:latest       ← convenience only; never deploy from this
```

**Deploying a new version to a site** = point that site's ECS service at the new image tag and let
ECS do a rolling replace:

```
site-A running web:9442a99
        │  update service → web:abc1234
        ▼
ECS starts a new task (web:abc1234) ──► health check passes ──► drains old task
        │  (if health check fails → ECS keeps the old task; no downtime)
        ▼
site-A running web:abc1234        ← rollback = re-point to web:9442a99
```

Because images are immutable and the database has versioned migrations, **rollback is just
re-deploying the previous tag** — with one caveat: a deploy that ran a *destructive* migration can't
be fully rolled back by image alone (the schema changed). That's why backups (§5) and
forward-only/expand-contract migrations matter. For non-destructive migrations, rollback is instant.

**Per-site version independence:** because each site is its own ECS service pointed at its own tag,
you can run site-A on `v1.4.0` and site-B on `v1.3.0` simultaneously. Roll out gradually; no
big-bang upgrades across all sites.

---

## 5. Backup & restore design

Two independent state stores, so two backup tracks. A restore is only "real" if **content and media
are recovered to a consistent point**, so we coordinate them.

### Database (content) — RDS
- **Automated backups + PITR:** enable RDS automated backups (7–35 day retention). This gives
  Point-In-Time-Recovery — restore the DB to any second in the window.
- **Manual snapshots before risky migrations:** `aws rds create-db-snapshot` keyed by deploy SHA, so
  a bad migration has a labeled restore point.
- **Logical dumps for portability/long-term:** scheduled `pg_dump` per site-database to S3 (Glacier
  for cold storage). This is what lets you hand a client their data or migrate clouds.

### Media (uploads) — S3
- **Versioning is already enabled** on the bucket (`aws_s3_bucket_versioning` in `terraform/main.tf`)
  — good. This means overwritten/deleted objects are recoverable.
- **Add lifecycle + (optionally) cross-region replication** for DR.
- Because media keys are deterministic (Payload stores the filename/key in the DB row), DB and S3
  stay referentially linked.

### The restore runbook (per site)
```
1. Decide the target time T (e.g. "5 minutes before the bad deploy").
2. RDS: restore DB to a new instance/endpoint at PITR time T   →  db-A-restored
3. S3: media objects at/just-before T are recoverable via versioning
       (Payload only references keys that existed at T, so newer versions are simply ignored).
4. Spin a container with env pointing DATABASE_URL → db-A-restored, S3 unchanged.
5. Verify (admin loads, images resolve), then cut the site's service over to the restored DB.
```

The thing that makes this clean is the **stateless container**: restoring a site is "point a fresh
container at restored state," never "rebuild a server and pray." This is the payoff of the §4
prerequisites in the README.

> **Backup test cadence:** a backup you've never restored is a hope, not a backup. The roadmap
> includes a quarterly "restore drill" into a throwaway environment.

---

## 6. Roadmap — from today to platform

Phased so each step delivers value and de-risks the next. Nothing here is destructive to the current
running site until you choose to cut over.

**Phase 0 — Prereqs (app changes).** Land the three changes in `PROPOSED_APP_CHANGES.md`
(media→S3, stable secret, standalone). After this, media survives server replacement — valuable even
*without* containers.

**Phase 1 — Containerize + local parity.** Use the `Dockerfile` + `docker-compose.yml` here. Goal:
`docker compose up` runs the full stack on your laptop (app + Postgres + MinIO). Build the image in
CI and push to **ECR**. Deliverable: a versioned image artifact exists.

**Phase 2 — Run one site as a container on AWS.** Simplest leap: run the image via `docker run` /
`docker compose` on the *existing* EC2 box (replace the PM2/nginx setup), pointing at the existing
RDS + S3. Proves the image works in prod with zero new infra. Keep the old setup one `git revert`
away.

**Phase 3 — ECS + ALB (the platform substrate).** Move to ECS Fargate behind an ALB. One service =
one site. Add a small **Terraform module** `modules/site/` whose inputs are `{ name, domain,
db_name, s3_prefix, builder_key }` — so "new site" = "new module instantiation + apply."

**Phase 4 — Backups & DR as code.** RDS automated backups + PITR, scheduled `pg_dump`→S3, S3
lifecycle/replication, and a documented + *tested* restore runbook (§5). First quarterly restore drill.

**Phase 5 — Make it a product.** CI/CD per site, a `new-site` script/CLI that provisions DB + bucket
+ secret + ECS service from one command, dashboards (CloudWatch), and eventually a self-serve flow if
you want to sell hosting.

---

## 7. Why these specific technology choices

- **ECS Fargate over Kubernetes:** you want a hosting *business*, not a platform-engineering hobby.
  Fargate gives container orchestration with near-zero cluster ops. EKS/K8s is justified only at much
  larger scale or with a dedicated platform team.
- **ECS over Lambda:** Payload + Next is a long-lived server with an admin UI and DB pool; it's a poor
  fit for request-scoped Lambda (cold starts, connection storms on RDS, 15-min cap). Containers are right.
- **Postgres (keep it):** the app already uses `@payloadcms/db-postgres` with committed migrations.
  RDS Postgres is the path of least resistance and the most portable.
- **S3 for media (not EFS):** object storage is cheaper, infinitely scalable, CDN-native via the
  existing CloudFront, and the standard Payload pattern. EFS would re-introduce a stateful mount.
- **Builder.io stays external:** it's a SaaS the app reads from via API key. Nothing to containerize;
  per-site isolation is just a per-site API key/space.

---

## 8. Open questions (decisions that shape the build)

1. **Isolation model:** Start shared (Model A) and upgrade clients to isolated (Model B) as needed? (my rec: yes)
2. **Runtime target:** Fargate as the platform, but prove it on the current EC2 first (Phase 2)? (my rec: yes)
3. **Custom domains per site:** needed day one, or start on subdomains of one domain? (affects ALB + ACM work)
4. **Site creation interface:** CLI-for-you now, self-serve later — or design for self-serve from the start?
5. **Migration discipline:** commit to expand/contract (forward-only, non-destructive) migrations so
   rollback-by-image-tag is always safe? (my rec: yes — it's the difference between instant rollback and a restore)

These don't block Phase 0/1 — we can start containerizing while these settle.
