'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Script from 'next/script'

const PROFILE_URL = 'https://www.linkedin.com/in/mark-musil?trk=profile-badge'

// LinkedIn's badge service (badges.linkedin.com) refuses requests it can't
// attribute to a logged-in member — HTTP 999 anti-bot page, which the browser
// then ORB-blocks — so the official embed renders blank for many visitors.
// Render the official markup, watch for the iframe it should inject, and swap
// in a styled lookalike card if it never arrives.
export function LinkedInBadge() {
  const badgeRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const el = badgeRef.current
    if (!el) return
    const hasIframe = () => !!el.querySelector('iframe')
    if (hasIframe()) return

    const observer = new MutationObserver(() => {
      if (hasIframe()) {
        setFailed(false)
        observer.disconnect()
        clearTimeout(timer)
      }
    })
    observer.observe(el, { childList: true, subtree: true })
    const timer = setTimeout(() => {
      if (!hasIframe()) setFailed(true)
    }, 5000)

    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <div ref={badgeRef} style={{ display: failed ? 'none' : 'block' }}>
        <div
          className="badge-base LI-profile-badge"
          data-locale="en_US"
          data-size="large"
          data-theme="light"
          data-type="VERTICAL"
          data-vanity="mark-musil"
          data-version="v1"
        >
          <a className="badge-base__link LI-simple-link" href={PROFILE_URL}>
            Mark Musil
          </a>
        </div>
      </div>

      {failed && (
        <div
          style={{
            width: '300px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
          }}
        >
          <div style={{ height: '8px', backgroundColor: '#0A66C2' }} />
          <div style={{ padding: '20px 24px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                margin: '0 auto 12px',
                borderRadius: '50%',
                overflow: 'hidden',
              }}
            >
              <Image
                src="/Mark.jpg"
                alt="Mark Musil"
                width={72}
                height={72}
                style={{ display: 'block', objectFit: 'cover', height: '72px' }}
              />
            </div>
            <div
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '16px',
                fontWeight: 600,
                color: '#1d1d1f',
                marginBottom: '2px',
              }}
            >
              Mark Musil
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', marginBottom: '16px' }}>
              Considerate Systems LLC
            </div>
            <a
              href={PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '16px',
                border: '1px solid #0A66C2',
                color: '#0A66C2',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
              View profile
            </a>
          </div>
        </div>
      )}

      <Script
        src="https://platform.linkedin.com/badges/js/profile.js"
        strategy="lazyOnload"
      />
    </>
  )
}
