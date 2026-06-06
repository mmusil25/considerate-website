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
  /** Display width cap. Portrait clips look best at small/medium. */
  size?: 'small' | 'medium' | 'large' | 'full' | null
  /** Horizontal placement of the (capped-width) player within the column. */
  align?: 'left' | 'center' | 'right' | null
}

const SIZE_TO_MAXWIDTH: Record<string, string> = {
  small: '240px',
  medium: '400px',
  large: '640px',
  full: '100%',
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
export function VideoPlayer({ manifestUrl, sourceUrl, sourceMimeType, poster, size, align }: Props) {
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
        hls = new Hls({
          enableWorker: true,
          // hls.js defaults to a 500 kbps bandwidth estimate, so playback opens
          // on the lowest rung (~480p). These are short (~4s) clips — basically
          // ONE segment per rung — so whatever level it opens on is the WHOLE
          // video; there's no time to ramp. Assume a fat pipe so it opens on the
          // top rung; hls.js emergency-downswitches mid-segment if a viewer's
          // connection genuinely can't keep up.
          abrEwmaDefaultEstimate: 40_000_000,
          // Don't downscale quality to the (possibly small) player box.
          capLevelToPlayerSize: false,
        })
        hls.loadSource(manifestUrl)
        hls.attachMedia(video)
        // Belt-and-suspenders: force the first fragment to the highest rung,
        // independent of the bandwidth estimate, so short clips never open soft.
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hls) hls.startLevel = hls.levels.length - 1
        })
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

  const maxWidth = SIZE_TO_MAXWIDTH[size ?? 'full'] ?? '100%'
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'

  return (
    <div style={{ marginBottom: 32, display: 'flex', justifyContent: justify }}>
      <div style={{ width: '100%', maxWidth }}>
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
    </div>
  )
}
