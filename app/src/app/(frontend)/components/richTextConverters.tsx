import type { JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import { VideoPlayer } from '@/components/VideoPlayer'
import { ImageGrid, type ImageGridItem } from '@/components/ImageGrid'
import { imageDecorStyle } from '@/lib/imageStyle'
import { cdnUrl } from '@/lib/cdn'
import { mediaUrl } from '@/lib/media'

// Display width as a fraction of the content column, keyed by the `size` field
// configured on the Upload feature in payload.config.ts.
const SIZE_TO_WIDTH: Record<string, string> = {
  small: '25%',
  medium: '50%',
  large: '75%',
  full: '100%',
}

// `sizes` hint per display size so the optimizer serves a variant matched to the
// actual rendered slot instead of the original. The content column is capped at
// 600px (see the project/page layouts); below 640px it goes ~full-bleed, so each
// size is that fraction of the viewport on mobile and a fixed px cap on desktop.
const SIZE_TO_SIZES: Record<string, string> = {
  small: '(max-width: 640px) 25vw, 150px',
  medium: '(max-width: 640px) 50vw, 300px',
  large: '(max-width: 640px) 75vw, 450px',
  full: '(max-width: 640px) 100vw, 600px',
}

// Custom JSX converters for Payload Lexical rich text. We override only the
// `upload` converter so body images honor the per-image `alignment`, `size`,
// `alt`, and `caption` controls editors set in the admin panel. Everything else
// falls through to the default converters.
export const richTextConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    // Inline video clip (the `video` block from payload.config.ts). `node.fields.video`
    // is the populated Video doc when the body is queried at depth >= 2.
    video: ({ node }) => {
      const fields = (node.fields ?? {}) as { video?: unknown; caption?: string }
      const v =
        typeof fields.video === 'object' && fields.video
          ? (fields.video as Record<string, unknown>)
          : null
      // Unpopulated (still an id) or not finished transcoding -> nothing to play.
      if (!v || v.status !== 'ready') return null

      return (
        <figure style={{ margin: '16px 0' }}>
          <VideoPlayer
            manifestUrl={cdnUrl(v.hlsManifestKey as string | null)}
            sourceUrl={cdnUrl(v.sourceKey as string | null)}
            sourceMimeType={v.sourceMimeType as string | null}
            poster={cdnUrl(v.posterKey as string | null)}
            size={v.displaySize as 'small' | 'medium' | 'large' | 'full' | null}
            align={v.displayAlignment as 'left' | 'center' | 'right' | null}
            alt={v.alt as string | null}
          />
          {fields.caption ? (
            <figcaption
              style={{
                fontSize: '12px',
                fontStyle: 'italic',
                color: '#666',
                marginTop: '6px',
                textAlign: 'center',
              }}
            >
              {fields.caption}
            </figcaption>
          ) : null}
        </figure>
      )
    },
    // Image Grid block (the `imageGrid` block from payload.config.ts). Each row's
    // `image` is the populated media doc when the body is queried at depth >= 2.
    imageGrid: ({ node }) => {
      const fields = (node.fields ?? {}) as {
        images?: Array<{ image?: unknown; alt?: string; caption?: string }>
        columns?: string
        gap?: string
        aspectRatio?: string
        borderRadius?: string
        shadow?: string
      }

      const items = (fields.images ?? [])
        .map((row): ImageGridItem | null => {
          const doc =
            typeof row.image === 'object' && row.image
              ? (row.image as Record<string, unknown>)
              : null
          // Versioned URL so a re-crop (same S3 key) busts the image caches.
          const url = doc ? mediaUrl(doc as { url?: string | null; updatedAt?: string | null }) : null
          if (!doc || !url) return null
          // Skip non-image uploads (e.g. a PDF) — a grid is images only.
          const mimeType = (doc.mimeType as string | undefined) ?? ''
          if (!mimeType.startsWith('image')) return null

          return {
            url,
            alt: row.alt ?? (doc.alt as string | undefined) ?? '',
            caption: row.caption ?? null,
            width: (doc.width as number | undefined) ?? null,
            height: (doc.height as number | undefined) ?? null,
          }
        })
        .filter(Boolean) as ImageGridItem[]

      if (!items.length) return null

      return (
        <ImageGrid
          items={items}
          columns={fields.columns}
          gap={fields.gap}
          aspectRatio={fields.aspectRatio}
          borderRadius={fields.borderRadius}
          shadow={fields.shadow}
        />
      )
    },
  },
  upload: ({ node }) => {
    // value is the populated media doc (depth >= 1); fields holds our extra
    // controls. If unpopulated (still an id) we can't render an image.
    const doc =
      typeof node.value === 'object' ? (node.value as unknown as Record<string, unknown>) : null
    if (!doc) return null

    // Versioned URL so a re-crop (same S3 key) busts the image caches.
    const url = mediaUrl(doc as { url?: string | null; updatedAt?: string | null })
    if (!url) return null

    const mimeType = (doc.mimeType as string | undefined) ?? ''
    const fields = (node.fields ?? {}) as {
      alignment?: string
      size?: string
      alt?: string
      caption?: string
      shadow?: string
      borderRadius?: string
      borderStyle?: string
      borderWidth?: string
      borderColor?: string
    }

    // Non-image uploads (e.g. a PDF) just render as a download link.
    if (!mimeType.startsWith('image')) {
      return (
        <a href={url} rel="noopener noreferrer">
          {(doc.filename as string) ?? 'Download'}
        </a>
      )
    }

    const alignment = fields.alignment ?? 'center'
    const size = fields.size ?? 'medium'
    const width = SIZE_TO_WIDTH[size] ?? '50%'
    const sizes = SIZE_TO_SIZES[size] ?? SIZE_TO_SIZES.medium
    const alt = fields.alt ?? (doc.alt as string | undefined) ?? ''
    const intrinsicWidth = doc.width as number | undefined
    const intrinsicHeight = doc.height as number | undefined

    // Editor-chosen shadow / corner radius / border, applied directly to the
    // image element. Merged onto the base layout style below.
    const decor = imageDecorStyle(fields)

    // Figure layout depends on alignment. Float left/right lets body text wrap;
    // center/full are block-level.
    let figureStyle: CSSProperties
    switch (alignment) {
      case 'left':
        figureStyle = { float: 'left', width, margin: '4px 24px 12px 0', maxWidth: '100%' }
        break
      case 'right':
        figureStyle = { float: 'right', width, margin: '4px 0 12px 24px', maxWidth: '100%' }
        break
      case 'full':
        figureStyle = { display: 'block', width: '100%', margin: '0 0 16px' }
        break
      case 'center':
      default:
        figureStyle = { display: 'block', width, margin: '16px auto', maxWidth: '100%' }
        break
    }

    return (
      <figure style={figureStyle}>
        {/* Body images run through next/image so they're served as AVIF/WebP and
            resized to the rendered slot (via `sizes`) instead of the full-res
            original. Below the fold, so default lazy-loading is correct — no
            `priority`. next/image needs intrinsic dimensions; if the media doc
            lacks them we fall back to a plain <img> to avoid a render error. */}
        {intrinsicWidth && intrinsicHeight ? (
          <Image
            src={url}
            alt={alt}
            width={intrinsicWidth}
            height={intrinsicHeight}
            sizes={sizes}
            style={{ width: '100%', height: 'auto', display: 'block', ...decor }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            style={{ width: '100%', height: 'auto', display: 'block', ...decor }}
          />
        )}
        {fields.caption ? (
          <figcaption
            style={{
              fontSize: '12px',
              fontStyle: 'italic',
              color: '#666',
              marginTop: '6px',
              textAlign: alignment === 'center' ? 'center' : 'left',
            }}
          >
            {fields.caption}
          </figcaption>
        ) : null}
      </figure>
    )
  },
})
