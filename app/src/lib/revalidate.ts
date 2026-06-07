import { revalidatePath } from 'next/cache'

/**
 * Purge a set of routes from BOTH caches after a content change.
 *
 * Two layers cache pages now:
 *  1. Next's ISR/data cache at the origin   -> cleared with revalidatePath()
 *  2. The CloudFront edge cache             -> cleared with a CreateInvalidation
 *
 * Origin revalidation alone isn't enough: CloudFront keeps serving the edge copy
 * for the page's long `stale-while-revalidate` window, so an edit (e.g. attaching
 * a video) wouldn't appear until that entry expired. This is wired into the
 * Projects/Videos collection hooks so saving in the admin refreshes the live page.
 *
 * Everything is best-effort and wrapped in try/catch — a failed purge must never
 * block or fail the underlying CMS write.
 */
type PurgeArgs = {
  /** Exact Next paths to revalidate, e.g. `/projects/foo`, `/projects`. */
  paths?: string[]
  /** Dynamic Next routes to revalidate wholesale, e.g. `/projects/[slug]`. */
  routes?: string[]
  /** App-distribution invalidation paths (pages); wildcards allowed, e.g. `/projects/*`. */
  cdn?: string[]
  /**
   * Media-distribution invalidation paths — the raw S3 objects served from
   * CLOUDFRONT_DOMAIN, e.g. `/markmusil/foo.jpg`. Needed because that
   * distribution's cache key ignores query strings (terraform/main.tf), so a
   * re-crop that overwrites an existing object can't be busted with a `?v=` token
   * alone — its edge copy must be invalidated explicitly. Requires
   * ASSETS_CLOUDFRONT_DISTRIBUTION_ID + cloudfront:CreateInvalidation on that
   * distribution.
   */
  assetsCdn?: string[]
}

async function invalidate(distributionId: string | undefined, items: string[]): Promise<void> {
  if (!distributionId || items.length === 0) return
  try {
    const { CloudFrontClient, CreateInvalidationCommand } = await import('@aws-sdk/client-cloudfront')
    const client = new CloudFrontClient({ region: process.env.AWS_REGION || 'us-east-2' })
    await client.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          // Unique per call; Math.random is fine here (not security-sensitive).
          CallerReference: `purge-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
          Paths: { Quantity: items.length, Items: items },
        },
      }),
    )
  } catch (err) {
    console.error('[revalidate] CloudFront invalidation failed', err)
  }
}

export async function purge({
  paths = [],
  routes = [],
  cdn = [],
  assetsCdn = [],
}: PurgeArgs): Promise<void> {
  try {
    for (const p of paths) revalidatePath(p)
    for (const r of routes) revalidatePath(r, 'page')
  } catch (err) {
    console.error('[revalidate] revalidatePath failed', err)
  }

  // App distribution fronts the pages; the assets distribution fronts the raw
  // media objects. They're separate distributions with separate IDs.
  await Promise.all([
    invalidate(process.env.APP_CLOUDFRONT_DISTRIBUTION_ID, cdn),
    invalidate(process.env.ASSETS_CLOUDFRONT_DISTRIBUTION_ID, assetsCdn),
  ])
}
