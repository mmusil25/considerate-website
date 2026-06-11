import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { SiteHeader } from './components/SiteHeader'
import { NavMenu } from './components/NavMenu'
import type { Project } from '../../../payload-types'

// ISR so CloudFront can edge-cache the homepage while still picking up CMS
// edits (same pattern as /projects — see that page for the full rationale).
export const revalidate = 60

export default async function HomePage() {
  // Projects flagged "featured" in the admin surface here. The build container
  // has no DB, so tolerate the failure and render without the section.
  let featured: Project[] = []
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'projects',
      where: { featured: { equals: true } },
      sort: '-publishedAt',
      limit: 3,
      depth: 0,
    })
    featured = res.docs
  } catch {
    featured = []
  }

  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <p
          style={{
            fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#000000',
            maxWidth: '451px',
            margin: '0 auto 40px',
          }}
        >
          Considerate Systems LLC is a single member engineering consulting firm
          owned and operated by Mark Musil. I specialize in embedded systems,
          firmware, electrical engineering, web development, and DevOps — a
          complete technical partner from prototype to deployment.
          <br />
          <br />
          I maintain a dedicated electronics and prototyping facility for rapid
          development, and offer hourly, retainer, and fixed-price engagements
          to fit your project&apos;s scope. Hourly engagements typically start
          at $120/hr.
          <br />
          <br />
          Browse past work below (shared with permission), then schedule a
          meeting or reach out through the contact form.
        </p>

        <div style={{ margin: '0 auto 24px', width: 'fit-content' }}>
          <NavMenu />
        </div>

        <div style={{ width: '347px', margin: '0 auto', borderRadius: '16px', overflow: 'hidden' }}>
          <Image
            src="/Mark.jpg"
            alt="Mark Musil"
            width={347}
            height={520}
            sizes="347px"
            priority
            style={{ display: 'block', objectFit: 'cover' }}
          />
        </div>

        {featured.length > 0 && (
          <div style={{ maxWidth: '451px', margin: '48px auto 0' }}>
            <h2
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '11px',
                fontWeight: 500,
                color: '#185FA5',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '0 0 12px',
              }}
            >
              Selected work
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {featured.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <div style={{ backgroundColor: '#2C2C2A', padding: '14px 18px' }}>
                    <div
                      style={{
                        fontFamily: "'Work Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#ffffff',
                        marginBottom: '4px',
                      }}
                    >
                      {project.title}
                    </div>
                    {project.description && (
                      <p
                        style={{
                          fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                          fontSize: '13px',
                          color: 'rgba(255,255,255,0.6)',
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {project.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/projects"
              style={{
                display: 'inline-block',
                marginTop: '12px',
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: '13px',
                color: '#185FA5',
                textDecoration: 'underline',
              }}
            >
              View all projects
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
