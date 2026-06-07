'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useCallback, useRef, useState } from 'react'

type Phase = 'idle' | 'uploading' | 'finalizing' | 'processing' | 'done' | 'error'

const UPLOAD_CONCURRENCY = 4

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg?.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const VideoUploader = () => {
  const { id } = useDocumentInfo()
  // Read the "remove audio" checkbox live, so we send the editor's current intent
  // with the upload even if they haven't saved the doc yet. The flag travels as
  // S3 object metadata on the source → the transcode Lambda strips audio.
  const removeAudio = useFormFields(([fields]) => Boolean(fields?.removeAudio?.value))
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(
    async (file: File) => {
      setError(null)
      setProgress(0)
      setPhase('uploading')
      try {
        // 1. Begin multipart upload (server presigns; doc id namespaces the key).
        const { uploadId, key, partSize } = await postJSON('/api/videos/upload/create', {
          videoId: id,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
          removeAudio,
        })

        // 2. Slice into parts and PUT each directly to S3 via a presigned URL.
        const totalParts = Math.ceil(file.size / partSize)
        const parts: { PartNumber: number; ETag: string }[] = new Array(totalParts)
        let completed = 0

        const uploadPart = async (partNumber: number) => {
          const start = (partNumber - 1) * partSize
          const blob = file.slice(start, Math.min(start + partSize, file.size))
          const { url } = await postJSON('/api/videos/upload/sign-part', {
            key,
            uploadId,
            partNumber,
          })
          const put = await fetch(url, { method: 'PUT', body: blob })
          if (!put.ok) throw new Error(`Part ${partNumber} upload failed (${put.status})`)
          const etag = put.headers.get('ETag') || put.headers.get('etag')
          if (!etag) throw new Error(`Part ${partNumber} returned no ETag (check S3 CORS expose_headers)`)
          parts[partNumber - 1] = { PartNumber: partNumber, ETag: etag }
          completed += 1
          setProgress(Math.round((completed / totalParts) * 100))
        }

        // Bounded-concurrency worker pool over the part numbers.
        let next = 1
        const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalParts) }, async () => {
          while (next <= totalParts) {
            const pn = next++
            await uploadPart(pn)
          }
        })
        await Promise.all(workers)

        // 3. Finalize. In prod this fires the S3 event → transcode; locally it just
        //    marks the video ready (source playback).
        setPhase('finalizing')
        const result = await postJSON('/api/videos/upload/complete', {
          videoId: id,
          key,
          uploadId,
          parts,
          sourceMimeType: file.type,
        })

        if (result.status === 'processing') {
          setPhase('processing')
          // Reload so the form reflects the server-updated fields (status, sourceKey).
          // The transcode callback will flip status to ready asynchronously.
          setTimeout(() => window.location.reload(), 1500)
        } else {
          setPhase('done')
          setTimeout(() => window.location.reload(), 1200)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
        setPhase('error')
      }
    },
    [id, removeAudio],
  )

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void upload(file)
  }

  if (!id) {
    return (
      <div style={box}>
        <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
          💾 Save this video (with a title) first — then return here to upload the source file.
        </p>
      </div>
    )
  }

  return (
    <div style={box}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
        Source upload
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
        Upload your highest-quality original (4K60, any codec). It goes straight to S3 from your
        browser, then the pipeline produces an adaptive HLS ladder capped at the source quality.
      </p>

      {(phase === 'idle' || phase === 'error') && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            onChange={onPick}
            style={{ display: 'none' }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} style={btn}>
            Choose video file…
          </button>
        </>
      )}

      {phase === 'uploading' && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151' }}>Uploading… {progress}%</p>
          <Bar value={progress} />
        </div>
      )}

      {phase === 'finalizing' && (
        <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>Finalizing upload…</p>
      )}

      {phase === 'processing' && (
        <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
          ✅ Uploaded. Transcoding started — status will update to <strong>Ready</strong> when the
          HLS ladder is finished. Reloading…
        </p>
      )}

      {phase === 'done' && (
        <p style={{ margin: 0, fontSize: 13, color: '#059669' }}>
          ✅ Uploaded (local mode: no transcode — source plays directly). Reloading…
        </p>
      )}

      {error && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b91c1c' }}>⚠️ {error}</p>
      )}
    </div>
  )
}

const box: React.CSSProperties = {
  padding: 16,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  backgroundColor: '#f9fafb',
  marginBottom: 16,
}

const btn: React.CSSProperties = {
  padding: '8px 14px',
  backgroundColor: '#185FA5',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const Bar = ({ value }: { value: number }) => (
  <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
    <div
      style={{
        width: `${value}%`,
        height: '100%',
        backgroundColor: '#185FA5',
        transition: 'width 0.2s',
      }}
    />
  </div>
)
