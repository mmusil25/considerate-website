import Link from 'next/link'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import config from '@/payload.config'
import { SiteHeader } from '../../../components/SiteHeader'

export const dynamic = 'force-dynamic'

// CAPTRUST demo — advisor directory. Each advisor references one office
// location (populated via depth), which links through to the locations page.
export default async function AdvisorsDemoPage() {
  const payload = await getPayload({ config })
  const { docs: advisors } = await payload.find({
    collection: 'advisors',
    sort: 'lastName',
    depth: 1,
  })

  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#185FA5',
              margin: '0 0 4px',
            }}
          >
            CAPTRUST Demo
          </p>
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#2C2C2A',
              margin: '0 0 6px',
            }}
          >
            Our Advisors
          </h1>
          <p
            style={{
              fontFamily: "'Source Sans 3', sans-serif",
              fontSize: '14px',
              color: '#555',
              margin: '0 0 28px',
              lineHeight: 1.6,
            }}
          >
            Meet the team.{' '}
            <Link href="/demos/financial/location" style={{ color: '#185FA5' }}>
              View our offices →
            </Link>
          </p>

          {advisors.length === 0 ? (
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '14px', color: '#888' }}>
              No advisors yet — add some in the admin under “CAPTRUST demo”.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {advisors.map((a: any) => {
                const headshot = a.headshot && typeof a.headshot === 'object' ? a.headshot : null
                const location = a.location && typeof a.location === 'object' ? a.location : null
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #d6e4f0',
                      borderRadius: '4px',
                      padding: '16px',
                    }}
                  >
                    {headshot?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={headshot.url}
                        alt={`${a.firstName} ${a.lastName}`}
                        width={88}
                        height={88}
                        style={{
                          width: '88px',
                          height: '88px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0,
                          backgroundColor: '#e6f1fb',
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <h2
                        style={{
                          fontFamily: "'Source Sans 3', sans-serif",
                          fontSize: '17px',
                          fontWeight: 600,
                          color: '#2C2C2A',
                          margin: '0 0 2px',
                        }}
                      >
                        {a.firstName} {a.lastName}
                      </h2>
                      {location && (
                        <Link
                          href={`/demos/financial/location#loc-${location.id}`}
                          style={{
                            fontFamily: "'Work Sans', sans-serif",
                            fontSize: '12px',
                            color: '#185FA5',
                            textDecoration: 'none',
                          }}
                        >
                          {location.name} ↗
                        </Link>
                      )}
                      {a.bio && (
                        <div
                          style={{
                            fontFamily: "'Source Sans 3', sans-serif",
                            fontSize: '13px',
                            color: '#444',
                            lineHeight: 1.6,
                            marginTop: '8px',
                          }}
                        >
                          <RichText data={a.bio} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
