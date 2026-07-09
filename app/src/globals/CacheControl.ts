import type { GlobalConfig } from 'payload'
import { purge, purgeEverything } from '../lib/revalidate'

// Shared option list for every per-collection policy select below. Order matters:
// the first option is the default and the safest for editors (saves are visible
// everywhere immediately); the later ones trade freshness for fewer CloudFront
// invalidations (free tier: 1,000 paths/month, then $0.005/path).
const POLICY_OPTIONS = [
  {
    label: 'Refresh page + CDN on save — changes visible everywhere immediately',
    value: 'cdn',
  },
  {
    label: 'Refresh page on save — server regenerates now; CDN edge may lag ~1 minute',
    value: 'origin',
  },
  {
    label: 'Timed refresh only — no work on save; public page may lag a few minutes',
    value: 'none',
  },
]

const policyField = (name: string, description: string) => ({
  name,
  type: 'select' as const,
  defaultValue: 'cdn',
  options: POLICY_OPTIONS,
  admin: { description },
})

/**
 * Settings → Cache: site-owner control over page freshness.
 *
 * Two caches sit in front of every public page (see lib/revalidate.ts): Next's
 * ISR cache at the origin and the CloudFront edge. This global lets an editor
 * choose, per collection, what happens to those caches when content is saved —
 * and provides manual "clear cache" actions (the ui field) backed by the
 * `/api/globals/cache-control/purge` endpoint below.
 *
 * Media is intentionally NOT configurable: its hook also invalidates the exact
 * S3 object on the assets distribution (a re-crop overwrites the same key), and
 * letting that be switched off would reintroduce stale-image bugs.
 */
const CacheControl: GlobalConfig = {
  slug: 'cache-control',
  label: 'Cache',
  admin: {
    group: 'Settings',
    description:
      'Control how quickly content edits appear on the public site, and clear cached pages by hand.',
  },
  access: {
    read: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
  },
  endpoints: [
    {
      path: '/purge',
      method: 'post',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        let body: { scope?: string; path?: string } = {}
        try {
          body = req.json ? await req.json() : {}
        } catch {
          // fall through to validation below
        }

        if (body.scope === 'site') {
          await purgeEverything()
          return Response.json({ ok: true, cleared: 'entire site' })
        }

        const path = typeof body.path === 'string' ? body.path.trim() : ''
        if (!path.startsWith('/') || path.includes('*') || path.includes('..')) {
          return Response.json(
            { error: 'Provide a page path starting with "/", e.g. /projects' },
            { status: 400 },
          )
        }
        await purge({ paths: [path], cdn: [path] })
        return Response.json({ ok: true, cleared: path })
      },
    },
  ],
  fields: [
    // Manual actions — buttons only, no DB column. See CachePurgeButtons.tsx.
    {
      type: 'ui',
      name: 'purgeActions',
      admin: {
        components: { Field: '/components/payload/CachePurgeButtons#CachePurgeButtons' },
      },
    },
    {
      type: 'group',
      name: 'onSave',
      label: 'When content is saved',
      admin: {
        description:
          'What should happen to cached pages when an editor saves a document in each collection.',
      },
      fields: [
        policyField('projects', 'Project pages, the project list, and the sitemap.'),
        policyField('videos', 'Project pages that embed video clips.'),
        policyField('advisors', 'The CAPTRUST demo advisor and location directories.'),
        policyField('locations', 'The CAPTRUST demo location and advisor directories.'),
      ],
    },
  ],
}

export default CacheControl
