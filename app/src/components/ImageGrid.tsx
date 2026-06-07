import type { CSSProperties } from 'react'
import Image from 'next/image'
import { RADIUS_MAP, SHADOW_MAP } from '@/lib/imageStyle'

// A responsive grid of images for the project body. Rendered by the `imageGrid`
// lexical block (see richTextConverters.tsx), but it's a plain presentational
// component — no Payload imports, no data fetching — so it can be reused anywhere
// a set of images needs a tidy gallery. All cells share the column count, gap,
// optional uniform crop (aspectRatio), corner radius and shadow.

export interface ImageGridItem {
  url: string
  alt: string
  caption?: string | null
  width?: number | null
  height?: number | null
}

// gap / aspect keyed by the select `value`s declared in payload.config.ts.
const GAP_MAP: Record<string, string> = {
  none: '0',
  small: '8px',
  medium: '16px',
  large: '24px',
}

// `null` = keep each image's natural proportions; otherwise crop every cell to a
// uniform shape with object-fit: cover.
const ASPECT_MAP: Record<string, string | null> = {
  auto: null,
  square: '1 / 1',
  landscape: '4 / 3',
  wide: '16 / 9',
  portrait: '3 / 4',
}

interface ImageGridProps {
  items: ImageGridItem[]
  columns?: string | null
  gap?: string | null
  aspectRatio?: string | null
  borderRadius?: string | null
  shadow?: string | null
}

export function ImageGrid({
  items,
  columns = 'auto',
  gap = 'small',
  aspectRatio = 'auto',
  borderRadius = 'none',
  shadow = 'none',
}: ImageGridProps) {
  if (!items.length) return null

  const gapValue = GAP_MAP[gap ?? 'small'] ?? GAP_MAP.small
  // "Auto" fits as many ~180px columns as the content width allows (mirrors the
  // project gallery on projects/[slug]/page.tsx); a fixed count is an even split.
  const gridTemplateColumns =
    !columns || columns === 'auto'
      ? 'repeat(auto-fill, minmax(180px, 1fr))'
      : `repeat(${columns}, minmax(0, 1fr))`

  const aspect = ASPECT_MAP[aspectRatio ?? 'auto'] ?? null
  const radius = RADIUS_MAP[borderRadius ?? 'none'] ?? '0'
  const boxShadow = SHADOW_MAP[shadow ?? 'none'] ?? 'none'

  // Cells are at most ~300px in the 600px content column; below 640px they go
  // roughly half-viewport. Lets next/image serve a slot-sized variant.
  const sizes = '(max-width: 640px) 50vw, 300px'

  // The radius + shadow live on the wrapper, with overflow:hidden so a cropped
  // (cover) image is clipped to the rounded corners. A box-shadow on the wrapper
  // itself is NOT clipped by its own overflow, so the shadow still shows.
  const wrapperStyle: CSSProperties = {
    borderRadius: radius,
    overflow: 'hidden',
    boxShadow,
    lineHeight: 0,
    ...(aspect ? { position: 'relative', aspectRatio: aspect } : {}),
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: gapValue,
        margin: '16px 0',
      }}
    >
      {items.map((item, i) => (
        <figure key={i} style={{ margin: 0 }}>
          <div style={wrapperStyle}>
            {aspect ? (
              // Uniform crop: `fill` stretches to the aspect-ratio box and covers.
              // Works whether or not we know intrinsic dimensions.
              <Image
                src={item.url}
                alt={item.alt}
                fill
                sizes={sizes}
                style={{ objectFit: 'cover' }}
              />
            ) : item.width && item.height ? (
              <Image
                src={item.url}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes={sizes}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            ) : (
              // No intrinsic dimensions and no forced aspect — next/image can't
              // size itself, so fall back to a plain <img>.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.alt}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            )}
          </div>
          {item.caption ? (
            <figcaption
              style={{
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#666',
                marginTop: '4px',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {item.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  )
}
