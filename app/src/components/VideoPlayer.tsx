'use client'

import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'

type Props = {
  /** HLS master manifest URL (adaptive — the default playback path). */
  manifestUrl?: string | null
  /** Archived original URL (exact ceiling quality, incl. Opus where supported). */
  sourceUrl?: string | null
  /** MIME type of the original, used to feature-detect direct playback. */
  sourceMimeType?: string | null
  poster?: string | null
}

/**
 * Adaptive video player honoring the project's quality policy:
 *  - Default to HLS for near-instant start; its top rung already equals source
 *    quality, so capable broadband clients converge to the ceiling quickly.
 *  - Safari/iOS play HLS natively; everyone else uses hls.js.
 *  - If the browser can decode the original directly, offer a "Max quality
 *    (original)" toggle that streams the archived source via CloudFront range
 *    requests — preserving exact source quality/codecs.
 *  - With no HLS (local dev), fall back to playing the source directly.
 */
export function VideoPlayer({ manifestUrl, sourceUrl, sourceMimeType, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mode, setMode] = useState<'hls' | 'original'>('hls')
  const [canPlayOriginal, setCanPlayOriginal] = useState(false)

  // Feature-detect whether the browser can decode the original directly.
  useEffect(() => {
    const video = videoRef.current
    if (video && sourceUrl && sourceMimeType) {
      setCanPlayOriginal(video.canPlayType(sourceMimeType) === 'probably')
    }
  }, [sourceUrl, sourceMimeType])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null

    const playOriginal = mode === 'original' && sourceUrl

    if (playOriginal) {
      video.src = sourceUrl as string
    } else if (manifestUrl) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = manifestUrl // Safari / iOS native HLS
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true })
        hls.loadSource(manifestUrl)
        hls.attachMedia(video)
      } else if (sourceUrl) {
        video.src = sourceUrl // last-resort fallback
      }
    } else if (sourceUrl) {
      video.src = sourceUrl // local-dev / no-HLS path
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [manifestUrl, sourceUrl, mode])

  if (!manifestUrl && !sourceUrl) return null

  return (
    <div style={{ marginBottom: 32 }}>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4, backgroundColor: '#000' }}
      />
      {canPlayOriginal && manifestUrl && sourceUrl && (
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'hls' ? 'original' : 'hls'))}
          style={{
            marginTop: 8,
            fontFamily: "'Work Sans', sans-serif",
            fontSize: 11,
            color: '#185FA5',
            background: 'none',
            border: '1px solid #185FA5',
            borderRadius: 2,
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          {mode === 'hls' ? 'Max quality (original)' : 'Adaptive streaming (recommended)'}
        </button>
      )}
    </div>
  )
}
