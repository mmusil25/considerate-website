'use client'

// Client error boundary for the public site. Keeps the brand shell (manual
// header — SiteHeader pulls in nav state we may not have if rendering failed)
// and offers a reset. Errors are logged for CloudWatch via console.error.
export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('[frontend error boundary]', error)
  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 25px' }}>
        <div style={{ maxWidth: '480px', margin: '60px auto 0', textAlign: 'center' }}>
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
            Something went wrong
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
            This page hit an unexpected error.
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
            It&apos;s been logged. Trying again usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '9px 24px',
              backgroundColor: '#185FA5',
              color: '#ffffff',
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: '16px' }}>
            <a
              href="/"
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: '14px',
                color: '#185FA5',
                textDecoration: 'underline',
              }}
            >
              or head home
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
