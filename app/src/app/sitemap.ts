import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@/payload.config'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://consideratesystems.com'

// Revalidate the sitemap on the same cadence as the content pages.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/projects`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/services`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, changeFrequency: 'yearly', priority: 0.6 },
  ]

  // Build container has no DB (same pattern as generateStaticParams) — fall
  // back to the static routes; project URLs appear on the first runtime render.
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({ collection: 'projects', depth: 0, limit: 1000 })
    const projects: MetadataRoute.Sitemap = docs.map((p) => ({
      url: `${BASE}/projects/${p.slug}`,
      lastModified: p.updatedAt ? new Date(String(p.updatedAt)) : undefined,
      changeFrequency: 'monthly',
      priority: 0.8,
    }))
    return [...staticRoutes, ...projects]
  } catch {
    return staticRoutes
  }
}
