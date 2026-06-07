'use client'

import Hls from 'hls.js'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

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
  /** Accessible description of the clip — becomes the player's aria-label. */
  alt?: string | null
}

const SIZE_TO_MAXWIDTH: Record<string, string> = {
  small: '240px',
  medium: '400px',
  large: '640px',
  full: '100%',
}

/** A selectable HLS rung. `index` maps to hls.js `levels[]`. */
type Rung = { index: number; short: string; label: string }

/** "auto" = adaptive, "original" = archived source, otherwise a level index. */
type Choice = 'auto' | 'original' | number

// The "p" number is the short edge — correct for both portrait and landscape.
function shortRes(width: number, height: number): string {
  const short = Math.min(width || 0, height || 0)
  return short ? `${short}p` : 'SD'
}

/**
 * Adaptive video player honoring the project's quality policy:
 *  - Default to HLS, opened on the TOP rung. hls.js's default `testBandwidth`
 *    probes by loading the lowest rung first — fatal for these single-segment
 *    clips (there's no later segment to ramp on), so it's disabled and the high
 *    bandwidth estimate makes the first fragment pick the ceiling.
 *  - A YouTube-style quality menu (gear, top-right) lets viewers pin a specific
 *    rung or the archived original — "shit quality is worse than no video".
 *  - Safari/iOS play HLS natively (hls.js can't drive their levels, so they only
 *    get Auto/Original); everyone else uses hls.js.
 *  - With no HLS (local dev), fall back to playing the source directly.
 */
export function VideoPlayer({ manifestUrl, sourceUrl, sourceMimeType, poster, size, align, alt }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [choice, setChoice] = useState<Choice>('auto')
  const [rungs, setRungs] = useState<Rung[]>([])
  const [usingHlsJs, setUsingHlsJs] = useState(false)
  const [canPlayOriginal, setCanPlayOriginal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Feature-detect whether the browser can decode the original directly.
  useEffect(() => {
    const video = videoRef.current
    if (video && sourceUrl && sourceMimeType) {
      setCanPlayOriginal(video.canPlayType(sourceMimeType) === 'probably')
    }
  }, [sourceUrl, sourceMimeType])

  // (Re)attach the source whenever the original-vs-HLS choice flips. Pinning a
  // specific rung does NOT re-run this — it's applied to the live hls instance —
  // so switching quality never reloads the whole player.
  const playOriginal = choice === 'original' && !!sourceUrl
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null
    setUsingHlsJs(false)
    setRungs([])

    if (playOriginal) {
      video.src = sourceUrl as string
    } else if (manifestUrl) {
      // PREFER hls.js whenever it's supported (all desktop browsers — they have
      // MSE). Chromium/Chrome report `canPlayType('...mpegurl')` truthy and will
      // happily play the manifest NATIVELY, but native playback ignores every
      // hls.js setting (bandwidth estimate, testBandwidth) AND fires no
      // MANIFEST_PARSED, so it opens on the lowest rung and the quality menu
      // never mounts. Only fall back to native HLS when hls.js is unavailable —
      // i.e. iOS Safari, which has no MSE for video and must use native HLS.
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          // These are short (~4s) single-segment clips. hls.js's default
          // `testBandwidth: true` loads the LOWEST rung first to probe bandwidth
          // and ramps on the NEXT segment — but there is no next segment, so the
          // whole clip plays at the floor. Disable it and seed a fat-pipe estimate
          // so the first (only) fragment is chosen at the ceiling instead.
          testBandwidth: false,
          abrEwmaDefaultEstimate: 40_000_000,
          // Don't downscale quality to the (possibly small) player box.
          capLevelToPlayerSize: false,
        })
        hlsRef.current = hls
        hls.loadSource(manifestUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!hls) return
          hls.startLevel = hls.levels.length - 1
          setUsingHlsJs(true)
          setRungs(
            hls.levels
              .map((lvl, index) => ({
                index,
                short: shortRes(lvl.width, lvl.height),
                label: `${shortRes(lvl.width, lvl.height)}${lvl.bitrate ? ` · ${Math.round(lvl.bitrate / 1_000_000)} Mbps` : ''}`,
              }))
              .sort((a, b) => b.index - a.index),
          )
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = manifestUrl // native HLS fallback (iOS Safari — no MSE; can't drive levels)
      } else if (sourceUrl) {
        video.src = sourceUrl // last-resort fallback
      }
    } else if (sourceUrl) {
      video.src = sourceUrl // local-dev / no-HLS path
    }

    return () => {
      if (hls) hls.destroy()
      hlsRef.current = null
    }
  }, [manifestUrl, sourceUrl, playOriginal])

  // Apply a pinned rung (or re-enable ABR) to the live hls.js instance.
  function selectChoice(next: Choice) {
    setChoice(next)
    setMenuOpen(false)
    const hls = hlsRef.current
    if (!hls || next === 'original') return
    hls.currentLevel = next === 'auto' ? -1 : next // -1 re-enables adaptive
  }

  if (!manifestUrl && !sourceUrl) return null

  const maxWidth = SIZE_TO_MAXWIDTH[size ?? 'full'] ?? '100%'
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'

  const showOriginalOption = canPlayOriginal && !!manifestUrl && !!sourceUrl
  const showQualityMenu = (usingHlsJs && rungs.length > 1) || showOriginalOption
  const currentLabel =
    choice === 'auto'
      ? 'Auto'
      : choice === 'original'
        ? 'Original'
        : (rungs.find((r) => r.index === choice)?.short ?? 'Auto')

  const itemStyle = (active: boolean): CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 14px',
    fontFamily: "'Work Sans', sans-serif",
    fontSize: 12,
    color: '#fff',
    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ marginBottom: 32, display: 'flex', justifyContent: justify }}>
      <div style={{ width: '100%', maxWidth, position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          aria-label={alt ?? undefined}
          style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4, backgroundColor: '#000' }}
        />
        {showQualityMenu && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <button
              type="button"
              aria-label="Video quality"
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: "'Work Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(0,0,0,0.65)',
                border: 'none',
                borderRadius: 3,
                padding: '5px 9px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              <span aria-hidden style={{ fontSize: 13 }}>⚙</span>
              {currentLabel}
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  background: 'rgba(0,0,0,0.85)',
                  borderRadius: 4,
                  padding: '4px 0',
                  minWidth: 140,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                }}
              >
                <button type="button" style={itemStyle(choice === 'auto')} onClick={() => selectChoice('auto')}>
                  Auto
                </button>
                {usingHlsJs &&
                  rungs.map((r) => (
                    <button
                      key={r.index}
                      type="button"
                      style={itemStyle(choice === r.index)}
                      onClick={() => selectChoice(r.index)}
                    >
                      {r.label}
                    </button>
                  ))}
                {showOriginalOption && (
                  <button
                    type="button"
                    style={itemStyle(choice === 'original')}
                    onClick={() => selectChoice('original')}
                  >
                    Original (max)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
