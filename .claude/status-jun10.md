# Session status — Jun 10, 2026

Local-only work (NOT yet committed or deployed): keyboard-shortcut fix + major
content build-out. Continuation of `status-jun7.md`.

## What changed (all verified locally at localhost:3000)

### 1. Ctrl+Alt+S (and all nav shortcuts) fixed
- Root cause: `SiteHeader.tsx` matched `e.key`, but with Alt held the produced
  character is often NOT the plain letter (Option+S = 'ß' on macOS; Ctrl+Alt is
  AltGr on many Windows/Euro layouts), so the lookup missed.
- Fix: match the physical key via `e.code === 'Key<X>'` (with `e.key` fallback),
  ignore when focus is in input/textarea/contentEditable (don't hijack AltGr
  typing), bail on metaKey, and fall back to same-tab navigation if a popup
  blocker nulls `window.open`. Verified via devtools-dispatched events for both
  the 's' and 'ß' cases.

### 2. New pages (static, code not CMS)
- `/about` — bio, full experience timeline (resume-sourced), education/certs,
  publications (3, linked), external links. `app/src/app/(frontend)/about/page.tsx`.
- `/services` — 5 service areas + engagement models (hourly $120/hr, retainer,
  fixed price). `app/src/app/(frontend)/services/page.tsx`.
- NavMenu: added "Services" (Ctrl+Alt+V) and "About Mark" (Ctrl+Alt+A) → 6 items.

### 3. Homepage "Selected work" section
- Homepage now queries `featured: true` projects (limit 3) and renders dark
  cards below the photo. Page switched from fully static to ISR
  (`revalidate = 60`, same pattern/rationale as /projects). Build-time DB
  absence tolerated via try/catch → section simply hidden.

### 4. Seed script: `app/src/seed.ts` (`cd app && npm run seed`)
- Idempotent (upsert technologies by name, projects by slug — safe to re-run,
  safe against prod with existing content).
- Seeds 29 technologies + 10 real projects sourced from Mark's resume
  (July 2025 PDF on markmusil.click) and portfolio: speech-to-task (HF Space),
  bacteria-detection CV, this-website platform (3 featured), Armada Power IoT
  fleet, ManTech counter-drone MBSE, Sawback GPR, ECS Federal radar software,
  Herbal Mission ecommerce, OpenWRT RPi router, Intel wafer-defect DNN.
- GOTCHA: `npx payload run src/seed.ts` exits 0 silently WITHOUT running (payload
  3.85). Script is run via `tsx` + `import 'dotenv/config'` instead. tsx added
  to devDependencies.
- GOTCHA: bare `npx payload migrate` hangs locally (interactive prompt about
  dev-mode push, stdin closed). Local dev doesn't need it — `next dev` pushes
  schema. No schema changes this session anyway → no new migration needed.
- Seed hooks log `[revalidate] revalidatePath failed ... static generation store
  missing` — expected outside a Next request context, harmless.

## To deploy (next session or when Mark says go)
1. Commit app/ changes (no migration needed — no schema change).
2. `scripts/deploy.sh` (build gotchas in status-jun7 still apply: --no-cache
   runner build was needed last time; deploy.sh does NOT invalidate CloudFront —
   run `aws cloudfront create-invalidation --distribution-id E39MAQBKX9JXY9 --paths '/*'`
   and warm `/`, `/about`, `/services`, `/projects`).
3. Run the seed against prod (export prod DATABASE_URL, `npm run seed`) OR enter
   projects via admin. Seeded projects have no images — Mark should add hero
   images/galleries via admin (alt text now required on upload).
4. Prod media still has empty alt='' backfill (Jun 7 follow-up still open).

## Local env notes
- docker compose db+minio were already up; `npm run dev` + `npm run seed` is the
  whole local loop.
- Production build verified locally with unreachable DATABASE_URL to simulate
  the Docker builder (homepage/projects fall back to empty lists at build).
