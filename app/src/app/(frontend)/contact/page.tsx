import { SiteHeader } from '../components/SiteHeader'

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

export default function ContactPage() {
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

          <form style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="name" style={labelStyle}>Name</label>
                <input id="name" name="name" type="text" placeholder="Your name" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input id="email" name="email" type="email" placeholder="you@example.com" style={inputStyle} />
              </div>
            </div>

            <div>
              <label htmlFor="subject" style={labelStyle}>Subject</label>
              <input
                id="subject"
                name="subject"
                type="text"
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
                placeholder="Tell me about your project — scope, timeline, and any constraints that matter."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
              />
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
