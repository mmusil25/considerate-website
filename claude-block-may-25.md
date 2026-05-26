# Payload Admin 500 Error – Investigation Notes (May 25–26 2026)

## What's working

- Homepage (`/`) returns 200 ✓
- App builds successfully (`npm run build`) ✓
- Database is connected (PostgreSQL on RDS via SSL) ✓
- Database tables exist (migration ran: `20260526_000858`) ✓
- Config loads correctly at the Node level (verified below) ✓
- pm2 is running the app (`next start`) ✓

## What's broken

`http://3.149.29.20:3000/admin` returns 500.  
It redirects to `/admin/create-first-user` or `/admin/login`, both also 500.

## The error (from pm2 logs)

```
TypeError: Cannot destructure property 'routes' of '{}' as it is undefined.
    at ignore-listed frames { digest: '2039063274' }

TypeError: Cannot destructure property 'config' of 'Z(...)' as it is undefined.
    at ignore-listed frames { digest: '2914990160' }
```

Next.js hides the stack with "ignore-listed frames". The digests are stable hashes
of the error + location, but the location itself isn't exposed in logs.

## What we know about the first error

`RootPage` (from `@payloadcms/next/views`) does this near the top:

```javascript
// node_modules/@payloadcms/next/dist/views/Root/index.js line 25-35
const config = await configPromise;
const {
  admin: {
    routes: { createFirstUser: _createFirstUserRoute },
    user: userSlug,
  },
  routes: { admin: adminRoute },
} = config;
```

The error `Cannot destructure property 'routes' of '{}'` means that `config.admin`
is `{}` (empty) — so `config.admin.routes` is undefined, and destructuring fails.

**But**: we added debug logging and confirmed that when WE await `config`, it's correct:

```
[admin] config type: object
[admin] admin keys: [ 'avatar', 'components', 'custom', 'dateFormat', 'dependencies',
                      'theme', 'user', 'importMap', 'meta', 'routes', 'dashboard', 'timezones' ]
[admin] admin.routes: { account: '/account', createFirstUser: '/create-first-user', ... }
[admin] routes: { admin: '/admin', api: '/api', ... }
```

So **our** `await config` is correct. But something **inside** `RootPage` gets a broken config.

## Root cause hypothesis

`RootPage` passes the resolved config into `initReq` (line 103 in Root/index.js):
```javascript
configPromise: config,   // ← this is the RESOLVED SanitizedConfig, not a Promise
```

`initReq` then calls:
```javascript
const config = await configPromise;   // await of non-Promise: returns the value
const payload = await getPayload({ config, cron: true, importMap });
```

`getPayload` internally calls `new BasePayload().init(options)`.  
The question is: does `BasePayload.init` handle a **pre-sanitized** SanitizedConfig
the same as a raw Config? If `sanitizeConfig` is called a second time on an already-
sanitized config, it may strip or corrupt `admin.routes`.

## About the second error (digest 2914990160)

This one has been **consistent across all admin page rewrites**, which means it's from
code that DIDN'T change — most likely the API route handler at:

```
app/src/app/api/[...slug]/route.ts
```

That file does:
```typescript
import config from '@/payload.config'
export const GET = REST_GET(config as any)
```

The REST handlers import `config` at module-load time. If those handlers are somehow
getting called with a bad config (e.g., because of module caching or import order),
this would explain the persistent error.

## Current state of key files

### app/src/app/(payload)/admin/[[...segments]]/page.tsx
```typescript
import configPromise from '@/payload.config'
import { importMap } from '../importMap.js'
import { RootPage } from '@payloadcms/next/views'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

const Page = async ({ params, searchParams }) => {
  await getPayload({ config: configPromise, importMap })
  return RootPage({ config: configPromise, importMap, params, searchParams })
}

export default Page
```

### app/src/app/api/[...slug]/route.ts
```typescript
import config from '@/payload.config'
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'
export const GET = REST_GET(config as any)
export const POST = REST_POST(config as any)
export const DELETE = REST_DELETE(config as any)
export const PATCH = REST_PATCH(config as any)
export const PUT = REST_PUT(config as any)
export const OPTIONS = REST_OPTIONS(config as any)
```

### app/src/payload.config.ts
```typescript
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import Projects from './collections/Projects.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: { user: 'users' },
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
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
})
```

Note: `buildConfig` is **async** in Payload v3 — it returns `Promise<SanitizedConfig>`.  
So `config` at the module level IS a Promise when imported by other files.

## Test commands to run on EC2

SSH in:
```bash
ssh -i ~/.ssh/id_rsa ubuntu@3.149.29.20
```

### Check pm2 status and logs
```bash
pm2 status
pm2 logs portfolio --lines 50 --nostream
```

### Manually verify the config loads correctly
```bash
cd /var/www/portfolio/app
node -e "
process.env.NODE_ENV='production'
import('/var/www/portfolio/app/src/payload.config.ts').then(async m => {
  const config = await m.default
  console.log('admin.routes:', JSON.stringify(config.admin?.routes, null, 2))
  console.log('routes:', JSON.stringify(config.routes, null, 2))
  process.exit(0)
}).catch(e => { console.error(e.message); process.exit(1) })
"
```

### Verify database tables exist
```bash
# Install psql if needed: sudo apt-get install -y postgresql-client
psql "$(grep DATABASE_URL /var/www/portfolio/app/.env | cut -d= -f2)" -c "\dt" 2>&1
```

### Manually hit the admin endpoint and see raw response
```bash
curl -v http://localhost:3000/admin/create-first-user 2>&1 | head -50
```

### Check if Next.js is showing a more detailed error in dev mode
```bash
cd /var/www/portfolio/app
NODE_ENV=development node_modules/.bin/next dev --port 3001 &
sleep 10
curl -sL http://localhost:3001/admin/create-first-user 2>&1 | head -200
```
(Dev mode shows full stack traces instead of digests)

### Try running Next.js with more error detail in production
```bash
cd /var/www/portfolio/app
NODE_OPTIONS='--enable-source-maps' NODE_ENV=production node_modules/.bin/next start --port 3002 &
sleep 5
curl -sL http://localhost:3002/admin/create-first-user -o /tmp/admin-response.html
# Then look for error details in the response
grep -o 'digest.*"' /tmp/admin-response.html | head -5
```

## Paths to investigate

### 1. Run in development mode to see full stack traces
Development mode doesn't suppress stack traces. Run `next dev` temporarily:
```bash
cd /var/www/portfolio/app && NODE_ENV=development npx next dev --port 3001
```
Then visit `http://3.149.29.20:3001/admin` and the browser/curl will show the full error.

### 2. Check if `sanitizeConfig` is being called twice
The suspicion is that `RootPage` → `initReq` → `getPayload` tries to re-sanitize
the already-sanitized config. Add a log inside `sanitize.js`:
```bash
node -e "
const fs = require('fs')
const code = fs.readFileSync('/var/www/portfolio/app/node_modules/payload/dist/config/sanitize.js', 'utf8')
// look for where admin.routes is set
const idx = code.indexOf('admin.routes')
console.log(code.slice(idx-200, idx+200))
"
```

### 3. Look at what Payload version's template does vs ours
Payload v3 official Next.js template:
https://github.com/payloadcms/payload/tree/main/templates/website/src/app/(payload)
Compare their `admin/[[...segments]]/page.tsx` to ours.

### 4. Check if the REST route error is causing the admin 500
The API route (`[...slug]/route.ts`) imports config at module load time with `as any`.
If this causes an initialization error that corrupts the module cache, it could
cascade to the admin. Try removing the API route temporarily to isolate.

### 5. Downgrade @payloadcms/next or payload
Payload v3.84.1 is the latest. Earlier versions (3.0.x–3.30.x) may have had
different `RootPage` behavior. Check the Payload changelog for breaking changes
around the admin page props.

### 6. Try the Payload v3 blank template approach
```bash
cd /tmp
npx create-payload-app@latest my-test --template blank --db postgres
# Compare the generated admin page to ours
cat my-test/src/app/(payload)/admin/\[\[...segments\]\]/page.tsx
```

## What we've changed so far (in order)

1. Fixed tsx ESM resolution: `import Projects from './collections/Projects.ts'`
2. Added `import type` for `CollectionConfig` in `Projects.ts`
3. Added `"type": "module"` to `package.json`
4. Added `"allowImportingTsExtensions": true` to `tsconfig.json`
5. Ran `npx payload migrate:create --name init` → created migration file
6. Ran `npx payload migrate` → database tables created successfully
7. Ran `npx payload generate:importmap` → generated `importMap.js`
8. Rewrote admin page multiple times (see above for current version)
9. Added generated `importMap.js` to git

## Infrastructure summary

- EC2 IP: `3.149.29.20`
- App: `/var/www/portfolio/app/`
- Node: 22.22.2
- pm2 process: `portfolio` (runs `npm start` = `next start`)
- .env: `/var/www/portfolio/app/.env`
- RDS: `portfolio-db.cfqoee6ueqrd.us-east-2.rds.amazonaws.com:5432`
- Payload version: 3.84.1
- Next.js version: 16.2.6 (Turbopack)
