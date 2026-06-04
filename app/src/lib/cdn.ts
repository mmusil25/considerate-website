/**
 * Build a public URL for an S3 object key.
 *
 * In production, video assets (HLS manifests, segments, posters, the archived
 * original) are served through CloudFront for speed + caching. Locally there is no
 * CloudFront, so we fall back to the S3/MinIO endpoint so the player still works.
 *
 * Keys are stored WITHOUT a leading slash (e.g. "videos/hls/<id>/index.m3u8").
 */
export function cdnUrl(key?: string | null): string | null {
  if (!key) return null
  const cleanKey = key.replace(/^\/+/, '')

  const cloudfront = process.env.CLOUDFRONT_DOMAIN
  if (cloudfront) {
    return `https://${cloudfront}/${cleanKey}`
  }

  // Local / non-CloudFront fallback. Mirrors how the s3Storage plugin addresses
  // objects: path-style against the endpoint when one is set (MinIO), otherwise
  // the virtual-hosted S3 URL.
  const bucket = process.env.S3_BUCKET || ''
  const endpoint = process.env.S3_ENDPOINT
  if (endpoint) {
    return `${endpoint.replace(/\/+$/, '')}/${bucket}/${cleanKey}`
  }

  const region = process.env.AWS_REGION || 'us-east-2'
  return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`
}
