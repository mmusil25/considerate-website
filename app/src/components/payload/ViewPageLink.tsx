'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

// Sidebar link that jumps from a document in the admin panel to the live,
// public page that renders it. Added as a `ui` field (no DB column, no
// migration) to every collection whose docs map to a real front-end route.
//
// Each collection resolves to a URL differently, so the mapping lives here:
//  - projects   -> /projects/<slug>            (one page per doc, needs the slug)
//  - advisors   -> /demos/financial/advisor    (single directory page)
//  - locations  -> /demos/financial/location   (single directory page)
//
// Links are relative, so they resolve against whatever origin the admin is
// served from (localhost in dev, the real domain in prod) without extra config.
const ROUTES: Record<string, { href: (slug?: string) => string | null; label: string }> = {
  projects: {
    href: (slug) => (slug ? `/projects/${slug}` : null),
    label: 'View this project on the live site',
  },
  advisors: {
    href: () => '/demos/financial/advisor',
    label: 'View the advisor directory on the live site',
  },
  locations: {
    href: () => '/demos/financial/location',
    label: 'View the location directory on the live site',
  },
}

export const ViewPageLink = () => {
  const { id, collectionSlug } = useDocumentInfo()
  // Read reactively so the link tracks the slug field as it's edited. Only the
  // `projects` route uses it, but the hook must run unconditionally.
  const slug = useFormFields(([fields]) => fields?.slug?.value as string | undefined)

  const route = collectionSlug ? ROUTES[collectionSlug] : undefined
  if (!route) return null

  const wrapStyle = { padding: '12px 0', borderTop: '1px solid #e5e7eb' } as const

  // Brand-new, unsaved docs have no page yet (and `projects` has no slug until
  // the first save). Nudge the editor to save rather than show a dead link.
  if (!id || (collectionSlug === 'projects' && !slug)) {
    return (
      <div style={wrapStyle}>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          Save this {collectionSlug === 'projects' ? 'project' : 'entry'} to get a link to its live
          page.
        </p>
      </div>
    )
  }

  const href = route.href(slug)
  if (!href) return null

  return (
    <div style={wrapStyle}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#185FA5',
          textDecoration: 'none',
        }}
      >
        {route.label} ↗
      </a>
    </div>
  )
}
