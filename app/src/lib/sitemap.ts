import type { Payload } from 'payload'

/**
 * Single source of truth for sitemap entries. Consumed by:
 *  - app/sitemap.ts            -> public /sitemap.xml (ISR, hourly + on project save)
 *  - components/payload/SitemapView -> live view in the admin at /admin/sitemap
 *
 * Static routes are declared here so adding a page means updating ONE list.
 */
export const SITE_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://consideratesystems.com'

export type SitemapEntry = {
  url: string
  lastModified?: Date
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
  /** Where the entry came from — lets the admin view group them. */
  source: 'static' | 'projects'
}

export const STATIC_ENTRIES: SitemapEntry[] = [
  { url: `${SITE_BASE}/`, changeFrequency: 'weekly', priority: 1, source: 'static' },
  { url: `${SITE_BASE}/projects`, changeFrequency: 'weekly', priority: 0.9, source: 'static' },
  { url: `${SITE_BASE}/services`, changeFrequency: 'monthly', priority: 0.8, source: 'static' },
  { url: `${SITE_BASE}/about`, changeFrequency: 'monthly', priority: 0.7, source: 'static' },
  { url: `${SITE_BASE}/contact`, changeFrequency: 'yearly', priority: 0.6, source: 'static' },
]

/** All sitemap entries, live from the DB. Throws if the DB is unreachable —
 *  callers decide the fallback (the public route falls back to STATIC_ENTRIES). */
export async function getSitemapEntries(payload: Payload): Promise<SitemapEntry[]> {
  const { docs } = await payload.find({
    collection: 'projects',
    depth: 0,
    limit: 1000,
    sort: 'slug',
  })
  const projects: SitemapEntry[] = docs.map((p) => ({
    url: `${SITE_BASE}/projects/${p.slug}`,
    lastModified: p.updatedAt ? new Date(String(p.updatedAt)) : undefined,
    changeFrequency: 'monthly',
    priority: 0.8,
    source: 'projects',
  }))
  return [...STATIC_ENTRIES, ...projects]
}
