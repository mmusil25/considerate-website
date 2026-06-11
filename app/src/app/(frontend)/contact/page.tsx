import { SiteHeader } from '../components/SiteHeader'
import { submitContact } from './actions'

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
  fontSize: '14px',
  color: '#2C2C2A',
  backgroundColor: '#ffffff',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: '2px',
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: "'Work Sans', sans-serif",
  fontSize: '11px',
  fontWeight: 500,
  color: '#2C2C2A',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '5px',
}

const bannerBase: React.CSSProperties = {
  fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
  fontSize: '14px',
  lineHeight: 1.5,
  padding: '10px 14px',
  borderRadius: '2px',
  marginBottom: '24px',
}

const BANNERS: Record<string, { style: React.CSSProperties; text: string }> = {
  sent: {
    style: { ...bannerBase, backgroundColor: '#E7F4E4', color: '#1E4620', border: '1px solid #B7DFB9' },
    text: "Thanks — your message is on its way. I'll get back to you within one business day.",
  },
  invalid: {
    style: { ...bannerBase, backgroundColor: '#FDECEA', color: '#611A15', border: '1px solid #F5C6CB' },
    text: 'Please fill in every field (with a valid email address) and try again.',
  },
  rate: {
    style: { ...bannerBase, backgroundColor: '#FDECEA', color: '#611A15', border: '1px solid #F5C6CB' },
    text: 'Too many messages from this connection — please wait a bit and try again, or email me directly.',
  },
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const params = await searchParams
  const banner = params.sent ? BANNERS.sent : params.error ? BANNERS[params.error] : undefined
  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '22px',
              fontWeight: 600,
              color: '#2C2C2A',
              marginBottom: '6px',
            }}
          >
            Get in touch
          </h1>
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '14px',
              color: '#555',
              marginBottom: '32px',
              lineHeight: 1.6,
            }}
          >
            Describe your project and I&apos;ll get back to you within one
            business day. Prefer a call?{' '}
            <a
              href="https://meet.consideratesystems.com/mark"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#185FA5', textDecoration: 'underline' }}
            >
              Schedule a free intro call.
            </a>
          </p>

          {banner && (
            <div role="status" style={banner.style}>
              {banner.text}
            </div>
          )}

          <form action={submitContact} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Name</label>
                <input id="name" name="name" type="text" required maxLength={200} placeholder="Your name" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input id="email" name="email" type="email" required maxLength={320} placeholder="you@example.com" style={inputStyle} />
              </div>
            </div>

            <div>
              <label htmlFor="subject" style={labelStyle}>Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                maxLength={300}
                placeholder="What are you working on?"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="message" style={labelStyle}>Message</label>
              <textarea
                id="message"
                name="message"
                rows={6}
                required
                maxLength={5000}
                placeholder="Tell me about your project — scope, timeline, and any constraints that matter."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
              />
            </div>

            {/* Honeypot — hidden from humans, irresistible to bots. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
              <label htmlFor="company">Company</label>
              <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div>
              <button
                type="submit"
                style={{
                  padding: '0 24px',
                  height: '36px',
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
                Send message
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
