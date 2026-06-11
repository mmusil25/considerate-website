import Link from 'next/link'

/** Persistent "Sitemap" link in the admin nav (registered via afterNavLinks). */
export function SitemapNavLink() {
  return (
    <Link
      href="/admin/sitemap"
      style={{ display: 'block', padding: '6px 0', textDecoration: 'none' }}
      className="nav__link"
    >
      Sitemap
    </Link>
  )
}
