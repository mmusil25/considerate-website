import type { JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { CSSProperties } from 'react'
import { VideoPlayer } from '@/components/VideoPlayer'
import { cdnUrl } from '@/lib/cdn'

// Display width as a fraction of the content column, keyed by the `size` field
// configured on the Upload feature in payload.config.ts.
const SIZE_TO_WIDTH: Record<string, string> = {
  small: '25%',
  medium: '50%',
  large: '75%',
  full: '100%',
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
  },
  upload: ({ node }) => {
    // value is the populated media doc (depth >= 1); fields holds our extra
    // controls. If unpopulated (still an id) we can't render an image.
    const doc =
      typeof node.value === 'object' ? (node.value as unknown as Record<string, unknown>) : null
    if (!doc) return null

    const url = doc.url as string | undefined
    if (!url) return null

    const mimeType = (doc.mimeType as string | undefined) ?? ''
    const fields = (node.fields ?? {}) as {
      alignment?: string
      size?: string
      alt?: string
      caption?: string
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
    const alt = fields.alt ?? (doc.alt as string | undefined) ?? ''

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
        {/* Plain <img> mirrors Payload's default upload converter; the media doc
            carries intrinsic width/height to avoid layout shift. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          width={(doc.width as number | undefined) ?? undefined}
          height={(doc.height as number | undefined) ?? undefined}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
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
