import { getPayload } from 'payload'
import config from '@/payload.config'
import { completeMultipart, VIDEO_SOURCE_PREFIX } from '@/lib/s3-upload'

export const dynamic = 'force-dynamic'

/**
 * Finalize the multipart upload. Completing the object under videos/source/ is what
 * fires the S3 ObjectCreated event that triggers the transcode Lambda in production.
 *
 * Local/dev degrade: with no CloudFront/MediaConvert (CLOUDFRONT_DOMAIN unset) there
 * is no transcode pipeline, so we mark the video `ready` immediately and the player
 * falls back to playing the source file directly.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    videoId?: string | number
    key?: string
    uploadId?: string
    sourceMimeType?: string
    parts?: { PartNumber: number; ETag: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { videoId, key, uploadId, parts, sourceMimeType } = body
  if (!videoId || !key || !uploadId || !parts?.length) {
    return Response.json(
      { error: 'videoId, key, uploadId and parts are required' },
      { status: 400 },
    )
  }
  if (!key.startsWith(VIDEO_SOURCE_PREFIX)) {
    return Response.json({ error: 'Invalid key' }, { status: 400 })
  }

  await completeMultipart(key, uploadId, parts)

  const hasPipeline = !!process.env.CLOUDFRONT_DOMAIN
  const video = await payload.update({
    collection: 'videos',
    id: videoId,
    data: {
      sourceKey: key,
      sourceMimeType: sourceMimeType || null,
      status: hasPipeline ? 'processing' : 'ready',
    },
  })

  return Response.json({ ok: true, status: video.status })
}
