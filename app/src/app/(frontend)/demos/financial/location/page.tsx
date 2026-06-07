import Link from 'next/link'
import Image from 'next/image'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { mediaUrl } from '@/lib/media'
import { SiteHeader } from '../../../components/SiteHeader'

// ISR so CloudFront can edge-cache this page. Static route prerendered at build
// (no DB) -> try/catch bakes an empty fallback; regenerated with real data on
// first request and every `revalidate`s (warmed after deploy).
export const revalidate = 60

// CAPTRUST demo — office directory. Each location lists its advisors via the
// `employees` join field (populated from the advisors' `location` reference).
export default async function LocationsDemoPage() {
  let locations: any[] = []
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({ collection: 'locations', sort: 'name', depth: 2 })
    locations = res.docs
  } catch {
    locations = []
  }

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
            Our Offices
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
            Where we work.{' '}
            <Link href="/demos/financial/advisor" style={{ color: '#185FA5' }}>
              Meet our advisors →
            </Link>
          </p>

          {locations.length === 0 ? (
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '14px', color: '#888' }}>
              No offices yet — add some in the admin under “CAPTRUST demo”.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {locations.map((loc: any) => {
                const officeImage =
                  loc.officeImage && typeof loc.officeImage === 'object' ? loc.officeImage : null
                const employees: any[] = loc.employees?.docs ?? []
                const lat = loc.coordinates?.latitude
                const lng = loc.coordinates?.longitude
                const hasCoords = typeof lat === 'number' && typeof lng === 'number'
                return (
                  <div
                    key={loc.id}
                    id={`loc-${loc.id}`}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #d6e4f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      scrollMarginTop: '20px',
                    }}
                  >
                    {officeImage?.url &&
                      (officeImage.width && officeImage.height ? (
                        <Image
                          src={mediaUrl(officeImage)!}
                          alt={officeImage.alt || loc.name}
                          width={officeImage.width}
                          height={officeImage.height}
                          // Card spans the 640px column; full-bleed on mobile.
                          sizes="(max-width: 640px) 100vw, 640px"
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            display: 'block',
                            backgroundColor: '#e6f1fb',
                          }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(officeImage)!}
                          alt={officeImage.alt || loc.name}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            display: 'block',
                            backgroundColor: '#e6f1fb',
                          }}
                        />
                      ))}
                    <div style={{ padding: '16px' }}>
                      <h2
                        style={{
                          fontFamily: "'Source Sans 3', sans-serif",
                          fontSize: '18px',
                          fontWeight: 600,
                          color: '#2C2C2A',
                          margin: '0 0 6px',
                        }}
                      >
                        {loc.name}
                      </h2>
                      {loc.address && (
                        <p
                          style={{
                            fontFamily: "'Source Sans 3', sans-serif",
                            fontSize: '13px',
                            color: '#444',
                            lineHeight: 1.5,
                            margin: '0 0 6px',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {loc.address}
                        </p>
                      )}
                      {hasCoords && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: "'Work Sans', sans-serif",
                            fontSize: '12px',
                            color: '#185FA5',
                            textDecoration: 'none',
                          }}
                        >
                          📍 {lat.toFixed(4)}, {lng.toFixed(4)} — open in Maps ↗
                        </a>
                      )}

                      {employees.length > 0 && (
                        <div style={{ marginTop: '14px' }}>
                          <p
                            style={{
                              fontFamily: "'Work Sans', sans-serif",
                              fontSize: '11px',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: '#8a9aa6',
                              margin: '0 0 8px',
                            }}
                          >
                            Advisors at this office
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {employees.map((emp: any) => (
                              <Link
                                key={emp.id}
                                href="/demos/financial/advisor"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px 4px 4px',
                                  border: '1px solid #d6e4f0',
                                  borderRadius: '999px',
                                  textDecoration: 'none',
                                }}
                              >
                                {emp.headshot && typeof emp.headshot === 'object' && emp.headshot.url ? (
                                  <Image
                                    src={mediaUrl(emp.headshot)!}
                                    alt={emp.headshot.alt || `${emp.firstName} ${emp.lastName}`}
                                    width={22}
                                    height={22}
                                    // 22px slot — a 44px @2x variant, not the source.
                                    sizes="22px"
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '999px',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '999px',
                                      backgroundColor: '#e6f1fb',
                                    }}
                                  />
                                )}
                                <span
                                  style={{
                                    fontFamily: "'Source Sans 3', sans-serif",
                                    fontSize: '13px',
                                    color: '#2C2C2A',
                                  }}
                                >
                                  {emp.firstName} {emp.lastName}
                                </span>
                              </Link>
                            ))}
                          </div>
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
