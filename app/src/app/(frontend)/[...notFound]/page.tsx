import { notFound } from 'next/navigation'

// Catch-all for URLs no other route matched. The app has no single root
// layout (the (frontend) and (payload) groups each own one), so a top-level
// app/not-found.tsx can't render; routing unmatched paths into this group
// makes them use the styled (frontend)/not-found.tsx instead of Next's
// unstyled default. Specific routes (/admin, /api, sitemap.xml, …) always
// win over a catch-all, so nothing real is shadowed.
export default function CatchAllNotFound(): never {
  notFound()
}
