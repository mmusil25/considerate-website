import Link from 'next/link'
import { SiteHeader } from './components/SiteHeader'

export default function NotFound() {
  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />
        <div style={{ maxWidth: '480px', margin: '80px auto 0', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: '#185FA5',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            404 — Page not found
          </p>
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '22px',
              fontWeight: 600,
              color: '#2C2C2A',
              marginBottom: '12px',
            }}
          >
            This page doesn&apos;t exist (or moved).
          </h1>
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '14px',
              color: '#555',
              lineHeight: 1.6,
              marginBottom: '28px',
            }}
          >
            The link may be out of date. The work itself is still here:
          </p>
          <Link
            href="/projects"
            style={{
              display: 'inline-block',
              padding: '9px 24px',
              backgroundColor: '#185FA5',
              color: '#ffffff',
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '2px',
              textDecoration: 'none',
              letterSpacing: '0.03em',
            }}
          >
            Browse projects
          </Link>
          <p style={{ marginTop: '16px' }}>
            <Link
              href="/"
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: '14px',
                color: '#185FA5',
                textDecoration: 'underline',
              }}
            >
              or head home
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
