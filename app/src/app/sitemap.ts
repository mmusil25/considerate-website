import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getSitemapEntries, STATIC_ENTRIES } from '@/lib/sitemap'

// Regenerated hourly AND on every project save/delete (Projects hooks purge
// /sitemap.xml), so the public file tracks the CMS closely.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Build container has no DB (same pattern as generateStaticParams) — fall
  // back to the static routes; project URLs appear on the first runtime render.
  try {
    const payload = await getPayload({ config })
    return (await getSitemapEntries(payload)).map(({ source: _source, ...e }) => e)
  } catch {
    return STATIC_ENTRIES.map(({ source: _source, ...e }) => e)
  }
}
