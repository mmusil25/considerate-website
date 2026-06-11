import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { getSitemapEntries, SITE_BASE } from '../../lib/sitemap'

/**
 * Live sitemap view inside the Payload admin (/admin/sitemap). Queries the DB
 * on every load, so it always reflects current content — unlike the public
 * /sitemap.xml, which is ISR-cached (hourly + purged on project save).
 *
 * Custom admin views are NOT auth-guarded by Payload — the redirect below is
 * what keeps this admin-only.
 */
export async function SitemapView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  if (!initPageResult.req.user) redirect('/admin/login')

  const payload = initPageResult.req.payload
  let entries: Awaited<ReturnType<typeof getSitemapEntries>> = []
  let dbError = false
  try {
    entries = await getSitemapEntries(payload)
  } catch {
    dbError = true
  }

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--theme-elevation-100)',
    textAlign: 'left',
    fontSize: 13,
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginBottom: 8 }}>Sitemap</h1>
        <p style={{ marginBottom: 4, color: 'var(--theme-elevation-600)' }}>
          Live from the database — this is what{' '}
          <a href={`${SITE_BASE}/sitemap.xml`} target="_blank" rel="noopener noreferrer">
            {SITE_BASE}/sitemap.xml
          </a>{' '}
          serves after its next refresh (hourly, or immediately after a project is saved).
        </p>
        <p style={{ marginBottom: 24, color: 'var(--theme-elevation-600)' }}>
          {dbError ? 'Database unreachable — showing nothing.' : `${entries.length} URLs.`}
        </p>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={cellStyle}>URL</th>
              <th style={cellStyle}>Source</th>
              <th style={cellStyle}>Priority</th>
              <th style={cellStyle}>Change freq</th>
              <th style={cellStyle}>Last modified</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.url}>
                <td style={cellStyle}>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    {e.url.replace(SITE_BASE, '') || '/'}
                  </a>
                </td>
                <td style={cellStyle}>{e.source}</td>
                <td style={cellStyle}>{e.priority}</td>
                <td style={cellStyle}>{e.changeFrequency}</td>
                <td style={cellStyle}>
                  {e.lastModified ? e.lastModified.toISOString().slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Gutter>
    </DefaultTemplate>
  )
}
