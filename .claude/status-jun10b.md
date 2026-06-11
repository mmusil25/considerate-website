# Session status — Jun 10, 2026 (b: deploy session, after crash)

Previous session's computer crash lost nothing — all jun10 work was already
committed/pushed (`97b014b`, `53ed293`). This session DEPLOYED it all to prod
and seeded the prod database. Everything below is LIVE on consideratesystems.com.

## What shipped

### 1. Content build-out deployed (from status-jun10.md)
- `/about`, `/services`, homepage "Selected work", nav shortcut fix — all live.
- Deployed via manual build → marker-verify in image → push → `SKIP_BUILD=1
  scripts/deploy.sh`. No stale-cache rebuild needed this time (plain build was
  fresh; verified `about`/`services` dirs + "Selected work" inside the image
  before pushing).

### 2. Prod DB seeded — cosplay post preserved (the hard requirement)
- The live `jetblack-cosplay` project ("blog post" with 8 images + 8 videos,
  entered via admin) had to survive. Verified byte-level: text content
  identical before/after, all media intact.
- `seed.ts` gained a `createOnly` flag; jetblack-cosplay is in the seed
  create-only, so seeding can NEVER overwrite the rich prod version (it only
  materializes text-only on a fresh local DB). Prod log confirmed:
  "project exists, left untouched (createOnly): jetblack-cosplay".
- Seeded: 29 technologies + 10 projects created on prod.
- HOW PROD WAS SEEDED (RDS is not publicly accessible): one-off ECS task on
  the migrator task def — container name is `considerate-site-migrator`
  (NOT "migrate"), command override `["npx","tsx","src/seed.ts"]`,
  env `RUN_MIGRATIONS=false`, service subnets/SG, assignPublicIp=ENABLED.
  The :migrator image has full source + tsx (built FROM builder).

### 3. Pagination bug found & fixed (`4fc31ca`)
- `/projects` listing showed only 10 of 11 projects: `payload.find` defaults
  to `limit: 10`. Fixed with `pagination: false` on the listing query.
  Homepage featured `limit: 3` is intentional; `[slug]` queries are `limit: 1`;
  generateStaticParams `limit: 1000` only caps build-time prerender (on-demand
  ISR covers the rest) — left as is.
- Second deploy rolled out; all 11 projects verified live on /projects.

## State of prod
- 11 projects (10 seeded text-only + jetblack-cosplay rich).
- Homepage "Selected work" shows top-3 featured by date: jetblack-cosplay,
  considerate-systems-platform, bacteria-detection. (4 docs are featured=true;
  speech-to-task is the one cut by limit 3.)
- CloudFront invalidated (twice) + pages warmed; all 200.

## Open follow-ups
- Seeded projects have NO images — Mark should add hero images/galleries via
  admin (alt text required on upload).
- Prod media empty alt='' backfill (open since Jun 7).
- deploy.sh still doesn't invalidate CloudFront/warm pages — worth adding.
