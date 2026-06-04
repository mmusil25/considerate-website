# Schema.org / SEO / AI Markup System

## Why this exists

The site is a portfolio AND a live demo for consulting clients. A core selling
point is making schema.org structured data **visible and teachable inside the
Payload admin panel** — so Mark can record screencasts showing clients exactly
how human content maps to machine-readable markup. The implementation is
intentionally explicit (not hidden behind code) for this reason.

## What was built

### Collections
- **`Technologies`** (`app/src/collections/Technologies.ts`) — reusable tech
  lookup table. Fields: `name` (unique), `url`, `category` (select). Lets one
  technology be defined once and referenced everywhere. Admin group: "SEO & Content".
- **`SiteSettings`** (`app/src/collections/SiteSettings.ts`) — singleton-style
  doc with tabs for **Organization**, **Person (Founder)**, and **Services**.
  Feeds the global Organization + Person JSON-LD. Note: type generated as
  `SiteSetting` (singular) in `payload-types.ts`.
- **`Projects`** (`app/src/collections/Projects.ts`) — extended with a
  `structuredData` group:
  - `schemaType` select (CreativeWork / WebApplication / SoftwareSourceCode / Service)
  - `outcomes` textarea, `keywordsFocused` array (SEO keywords)
  - Four custom UI fields (teaching components, see below)
  - **`technologies` array changed from text → relationship** to `technologies`
    collection. This required a DB migration (`tech` → `tech_id`, "create column").

### Custom admin UI components (`app/src/components/payload/`)
All are `'use client'` and read **live form state via `useFormFields`** from
`@payloadcms/ui` (NOT the `siblingData` prop, which is only a one-time snapshot):
- **`SchemaTypeSelector.tsx`** — shows description of the selected schema type.
- **`SchemaFieldMapper.tsx`** — two-column "human-readable vs machine-readable"
  table; updates as you type.
- **`JSONLDPreview.tsx`** — expandable preview of the generated
  `<script type="application/ld+json">`. Live for scalar fields.
- **`TechStackSelector.tsx`** — basic/detailed toggle showing how technologies
  render as schema.org `mentions`; counts selected rows from form state.

### Schema generation utils (`app/src/lib/schema.ts`)
- `generateProjectJSONLD(project, baseUrl, schemaType?, siteSettings?)`
- `generateOrganizationJSONLD(settings, baseUrl)`
- `generatePersonJSONLD(settings)`
- `serializeJsonLD(obj)` — escapes `</script>` for safe HTML injection
- `SCHEMA_DESCRIPTIONS`, `SCHEMA_TYPE_OPTIONS`, `extractTextFromLexical()`

### Frontend injection
- **`app/src/app/(frontend)/components/SchemaInjector.tsx`** — server component
  that loads `SiteSettings` and injects combined Organization+Person JSON-LD via
  `@graph`. Rendered inside `<head>` in `(frontend)/layout.tsx`. Fails silently
  if SiteSettings doesn't exist yet.
- **`projects/[slug]/page.tsx`** — generates per-project JSON-LD and injects a
  `<script type="application/ld+json">` at the top of the returned JSX. Also adds
  it to `generateMetadata` via `other['application/ld+json']`.

## Critical config / gotchas (learned the hard way)
- **`payload.config.ts`** sets `admin.importMap.baseDir: path.resolve(dirname)`
  so component path-strings resolve relative to `src/`, not the project root.
- Custom components are referenced as **path strings**
  (e.g. `'/components/payload/JSONLDPreview#JSONLDPreview'`), NOT direct imports.
- After changing any custom-component wiring, **regenerate the import map**:
  `npx payload generate:importmap`. A stale
  `src/app/(payload)/admin/importMap.js` causes module-not-found 500s on `/admin`.
- Base URL comes from `NEXT_PUBLIC_BASE_URL` (fallback
  `https://considerate-systems.com`). Not yet set in `.env`.
- In frontend code, technologies are now objects (`t.tech.name`), not strings —
  list/detail pages were updated to read `.name`.

## Verify
- `npm run build` is clean. `/admin` returns 200.
- Admin: Projects → create → "Schema.org Structured Data" section shows the live
  mapper + JSON-LD preview.
- Frontend: view-source on `/` (org+person) and `/projects/<slug>` (project) for
  the `ld+json` script. Validate at https://search.google.com/test/rich-results.

## Known limitations / possible next steps
- In-admin JSON-LD preview shows scalar fields live; **technologies resolve to
  names only server-side**, so the admin preview notes them rather than listing
  names (the published page includes them fully as `mentions`).
- `basic vs detailed` tech toggle is currently illustrative (shows format
  examples); it does not yet switch the actual emitted markup.
- No BreadcrumbList / ItemList schema on the projects list page yet.
- `SiteSettings` is not enforced as a true singleton (could use Payload Globals).
- Set `NEXT_PUBLIC_BASE_URL` in `.env` for correct absolute URLs in production.
