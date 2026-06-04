import { getPayload } from 'payload'
import config from '@/payload.config'

export const dynamic = 'force-dynamic'

/**
 * Completion webhook called by the transcode Lambda when a MediaConvert job
 * finishes. Not user-authenticated — gated by a shared secret (WEBHOOK_SECRET)
 * that Terraform injects into both the Lambda and the ECS task.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    videoId?: string | number
    status?: 'ready' | 'error'
    hlsManifestKey?: string
    posterKey?: string
    durationMs?: number
    width?: number
    height?: number
    errorMessage?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { videoId, status } = body
  if (!videoId || !status) {
    return Response.json({ error: 'videoId and status are required' }, { status: 400 })
  }

  // Only set the fields the Lambda actually provided.
  const data: Record<string, unknown> = { status }
  for (const k of ['hlsManifestKey', 'posterKey', 'durationMs', 'width', 'height', 'errorMessage'] as const) {
    if (body[k] !== undefined && body[k] !== null) data[k] = body[k]
  }

  const payload = await getPayload({ config })
  await payload.update({ collection: 'videos', id: videoId, data })

  return Response.json({ ok: true })
}
