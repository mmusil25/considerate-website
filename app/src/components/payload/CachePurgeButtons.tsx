'use client'

import { useState } from 'react'
import { Button, toast } from '@payloadcms/ui'

// Manual cache actions on the Settings → Cache screen. Rendered as a `ui` field
// (no DB column); both buttons call the auth-guarded purge endpoint on the
// cache-control global (see globals/CacheControl.ts), which clears Next's ISR
// cache and the app CloudFront distribution.

// Public pages an editor is likely to want to clear — offered as datalist
// suggestions; any path can still be typed (e.g. /projects/some-slug).
const KNOWN_PAGES = [
  '/',
  '/about',
  '/contact',
  '/projects',
  '/services',
  '/demos/financial/advisor',
  '/demos/financial/location',
  '/sitemap.xml',
]

async function callPurge(body: { scope: 'site' } | { path: string }): Promise<string> {
  const res = await fetch('/api/globals/cache-control/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data.cleared
}

export const CachePurgeButtons = () => {
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState<'site' | 'path' | null>(null)

  const run = async (which: 'site' | 'path') => {
    setBusy(which)
    try {
      const cleared = await callPurge(which === 'site' ? { scope: 'site' } : { path })
      toast.success(`Cache cleared: ${cleared}. Fresh pages are being regenerated now.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cache clear failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ padding: '16px 0 4px', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>Clear cache now</h3>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280' }}>
        Force the public site to rebuild pages immediately, without waiting for the timed refresh.
      </p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          list="cache-purge-known-pages"
          placeholder="/projects/my-project"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
            minWidth: '260px',
          }}
        />
        <datalist id="cache-purge-known-pages">
          {KNOWN_PAGES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Button
          buttonStyle="secondary"
          size="small"
          disabled={busy !== null || !path.trim().startsWith('/')}
          onClick={() => run('path')}
        >
          {busy === 'path' ? 'Clearing…' : 'Clear cache for this page'}
        </Button>
        <Button
          buttonStyle="primary"
          size="small"
          disabled={busy !== null}
          onClick={() => run('site')}
        >
          {busy === 'site' ? 'Clearing…' : 'Clear cache globally'}
        </Button>
      </div>
    </div>
  )
}
