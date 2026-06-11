import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { SiteHeader } from '../components/SiteHeader'
import type { Project } from '../../../../payload-types'

// ISR so CloudFront can edge-cache this list (was force-dynamic -> private,
// no-cache). This is a static route, so it's prerendered at build where there's
// no DB — the try/catch lets the build bake an empty fallback instead of
// failing; the page regenerates with real data on first request and every
// `revalidate`s thereafter (we warm it right after deploy).
export const revalidate = 60

export default async function ProjectsPage() {
  let projects: Project[] = []
  try {
    const payload = await getPayload({ config })
    // pagination: false — Payload's find defaults to limit 10, which silently
    // drops the oldest projects once the portfolio grows past ten.
    const res = await payload.find({ collection: 'projects', sort: '-publishedAt', depth: 1, pagination: false })
    projects = res.docs
  } catch {
    projects = []
  }

  return (
    <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '22px',
              fontWeight: 600,
              color: '#2C2C2A',
              marginBottom: '6px',
            }}
          >
            Portfolio / Past Projects
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
            A selection of past engagements, shared with client permission.
          </p>

          {projects.length === 0 ? (
            <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: '14px', color: '#888' }}>
              No projects yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const techs = project.technologies
    ?.map((t) => {
      if (!t.tech) return null
      if (typeof t.tech === 'string') return t.tech
      if (typeof t.tech === 'object' && 'name' in t.tech) return (t.tech as any).name
      return null
    })
    .filter(Boolean) ?? []
  const date = project.publishedAt
    ? new Date(project.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null

  return (
    <Link
      href={`/projects/${project.slug}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          backgroundColor: '#2C2C2A',
          padding: '16px 18px',
          transition: 'background-color 0.1s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '4px',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              color: '#ffffff',
            }}
          >
            {project.title}
          </span>
          <span
            style={{
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '11px',
              color: '#8f9da3',
              flexShrink: 0,
            }}
          >
            {project.client && <>{project.client}{date ? ' · ' : ''}</>}
            {date}
          </span>
        </div>

        {project.description && (
          <p
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '13px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.5,
              margin: '0 0 10px',
            }}
          >
            {project.description}
          </p>
        )}

        {techs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {techs.map((tech, idx) => (
              <span
                key={`${tech}-${idx}`}
                style={{
                  fontFamily: "'Work Sans', sans-serif",
                  fontSize: '10px',
                  padding: '1px 6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '2px',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
