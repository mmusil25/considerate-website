import type { CSSProperties } from 'react'

// Shared visual-decoration maps for body images. Used by BOTH the single inline
// image (the UploadFeature converter) and the Image Grid block, so the same
// "Subtle / Medium / Strong" shadow or "Small / Medium / Large" radius means the
// same thing everywhere an editor sets it. Keys match the `value`s of the select
// options declared in payload.config.ts.

export const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  small: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  medium: '0 4px 12px rgba(0,0,0,0.15)',
  large: '0 12px 32px rgba(0,0,0,0.25)',
}

export const RADIUS_MAP: Record<string, string> = {
  none: '0',
  small: '4px',
  medium: '8px',
  large: '16px',
  full: '9999px',
}

export const BORDER_WIDTH_MAP: Record<string, string> = {
  thin: '1px',
  medium: '2px',
  thick: '4px',
}

export interface ImageDecorFields {
  shadow?: string | null
  borderRadius?: string | null
  borderStyle?: string | null
  borderWidth?: string | null
  borderColor?: string | null
}

// Build the CSS for an image's shadow / corner radius / border from the editor's
// selections. Returns only the keys that are actually set, so callers can spread
// it over a base style without clobbering width/height/etc.
export function imageDecorStyle(f: ImageDecorFields): CSSProperties {
  const style: CSSProperties = {}

  if (f.shadow && f.shadow !== 'none') {
    style.boxShadow = SHADOW_MAP[f.shadow] ?? undefined
  }
  if (f.borderRadius && f.borderRadius !== 'none') {
    style.borderRadius = RADIUS_MAP[f.borderRadius] ?? undefined
  }
  if (f.borderStyle && f.borderStyle !== 'none') {
    style.borderStyle = f.borderStyle
    style.borderWidth = BORDER_WIDTH_MAP[f.borderWidth ?? 'thin'] ?? '1px'
    style.borderColor = f.borderColor || '#2C2C2A'
  }

  return style
}
