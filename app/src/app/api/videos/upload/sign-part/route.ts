import { getPayload } from 'payload'
import config from '@/payload.config'
import { signUploadPart, VIDEO_SOURCE_PREFIX } from '@/lib/s3-upload'

export const dynamic = 'force-dynamic'

/**
 * Presign a single UploadPart URL. The browser PUTs a chunk directly to S3 with it.
 * The key is validated to live under the source prefix so we can't be tricked into
 * presigning writes to arbitrary locations.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { key?: string; uploadId?: string; partNumber?: number }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { key, uploadId, partNumber } = body
  if (!key || !uploadId || !partNumber) {
    return Response.json({ error: 'key, uploadId and partNumber are required' }, { status: 400 })
  }
  if (!key.startsWith(VIDEO_SOURCE_PREFIX)) {
    return Response.json({ error: 'Invalid key' }, { status: 400 })
  }

  const url = await signUploadPart(key, uploadId, partNumber)
  return Response.json({ url })
}
