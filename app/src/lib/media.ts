/**
 * Build a cache-busting public URL for a media (image) document.
 *
 * Payload writes a manual crop back to the SAME S3 key as the original, so the
 * stored `url` never changes — which means the browser, the next/image optimizer,
 * and CloudFront all keep serving the pre-crop bytes. Appending a version token
 * derived from the doc's `updatedAt` gives every edit a fresh URL, so those
 * caches miss and re-fetch.
 *
 * Note this alone is NOT enough for the media CloudFront distribution, whose
 * cache key ignores query strings (terraform/main.tf) — its edge copy of the
 * object must additionally be invalidated when the doc changes. That happens in
 * the `media` collection's afterChange hook (payload.config.ts), which calls
 * purge({ assetsCdn: [...] }).
 */
export function mediaUrl(
  doc?: { url?: string | null; updatedAt?: string | null } | null,
): string | null {
  if (!doc?.url) return null
  const v = doc.updatedAt ? Date.parse(doc.updatedAt) : NaN
  if (!Number.isFinite(v)) return doc.url
  return `${doc.url}${doc.url.includes('?') ? '&' : '?'}v=${v}`
}
