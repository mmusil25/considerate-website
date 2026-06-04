import { getPayload } from 'payload'
import config from '@/payload.config'
import { createMultipart } from '@/lib/s3-upload'

export const dynamic = 'force-dynamic'

// S3 caps multipart at 10,000 parts. Use 16 MB parts by default, scaling up for
// very large files so we never exceed the part limit on a multi-GB 4K source.
const MIN_PART = 16 * 1024 * 1024

/**
 * Start a direct-to-S3 multipart upload for an EXISTING Video doc. The source key
 * embeds the doc id (videos/source/<id>/<file>) so the Lambda can map the S3 event
 * back to this record. Returns the uploadId/key/partSize the browser needs to
 * upload chunks itself.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { videoId?: string | number; filename?: string; contentType?: string; fileSize?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { videoId, filename, contentType, fileSize } = body
  if (!videoId) return Response.json({ error: 'videoId is required (save the video first)' }, { status: 400 })
  if (!filename) return Response.json({ error: 'filename is required' }, { status: 400 })

  const { uploadId, key } = await createMultipart(
    String(videoId),
    filename,
    contentType || 'application/octet-stream',
  )

  await payload.update({ collection: 'videos', id: videoId, data: { status: 'uploading' } })

  // Keep parts under the 10k cap: ceil(size / 9000) leaves headroom.
  const partSize = fileSize ? Math.max(MIN_PART, Math.ceil(fileSize / 9000)) : MIN_PART

  return Response.json({ videoId, uploadId, key, partSize })
}
