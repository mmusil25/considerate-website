import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import config from '@/payload.config'
import { SiteHeader } from '../../components/SiteHeader'
import { generateProjectJSONLD, serializeJsonLD, type SchemaType } from '@/lib/schema'
import { cdnUrl } from '@/lib/cdn'
import { VideoPlayer } from '@/components/VideoPlayer'
import type { Media, Video } from '../../../../../payload-types'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
  })
  const project = docs[0]
  if (!project) return {}

  // Generate JSON-LD for schema
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://considerate-systems.com'
  const schemaType = (project.structuredData?.schemaType as SchemaType) || 'CreativeWork'
  const jsonld = generateProjectJSONLD(project, baseUrl, schemaType)

  return {
    title: project.title,
    description: project.description ?? undefined,
    other: {
      'application/ld+json': JSON.stringify(jsonld),
    },
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
  })

  const project = docs[0]
  if (!project) notFound()

  const heroImage = typeof project.image === 'object' ? (project.image as Media) : null
  const video =
    project.projectVideo && typeof project.projectVideo === 'object'
      ? (project.projectVideo as Video)
      : null
  const gallery = (project.gallery ?? [])
    .map((g) => (typeof g.image === 'object' ? (g.image as Media) : null))
    .filter(Boolean) as Media[]
  const techs = (project.technologies ?? []).map((t) => {
    const tech = typeof t.tech === 'object' ? t.tech : null
    if (!tech) return null
    return typeof tech === 'string' ? tech : tech.name
  }).filter(Boolean) as string[]
  const date = project.publishedAt
    ? new Date(project.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null

  // Generate JSON-LD for this project
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://considerate-systems.com'
  const schemaType = (project.structuredData?.schemaType as SchemaType) || 'CreativeWork'
  const jsonld = generateProjectJSONLD(project, baseUrl, schemaType)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLD(jsonld),
        }}
      />
      <main style={{ backgroundColor: '#E6F1FB', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '9px 25px 60px' }}>
        <SiteHeader />

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Back link */}
          <Link
            href="/projects"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: "'Work Sans', sans-serif",
              fontSize: '12px',
              color: '#185FA5',
              textDecoration: 'none',
              marginBottom: '24px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3L5 8l5 5"
                stroke="#185FA5"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            All projects
          </Link>

          {/* Title */}
          <h1
            style={{
              fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
              fontSize: '26px',
              fontWeight: 600,
              color: '#2C2C2A',
              margin: '0 0 8px',
              lineHeight: 1.2,
            }}
          >
            {project.title}
          </h1>

          {/* Meta row */}
          {(project.client || date) && (
            <p
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '12px',
                color: '#666',
                margin: '0 0 16px',
              }}
            >
              Client: {project.client}
              {project.client && date ? ' · ' : ''}
              {date}
            </p>
          )}

          {/* Technologies */}
          {techs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '24px' }}>
              {techs.map((tech) => (
                <span
                  key={tech}
                  style={{
                    fontFamily: "'Work Sans', sans-serif",
                    fontSize: '11px',
                    padding: '2px 8px',
                    backgroundColor: '#2C2C2A',
                    color: 'rgba(255,255,255,0.75)',
                    borderRadius: '2px',
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Hero image */}
          {heroImage?.url && (
            <div style={{ marginBottom: '32px' }}>
              <Image
                src={heroImage.url}
                alt={project.title}
                width={heroImage.width ?? 600}
                height={heroImage.height ?? 400}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          )}

          {/* Project video (adaptive HLS, ceiling-quality original toggle) */}
          {video?.status === 'ready' && (
            <VideoPlayer
              manifestUrl={cdnUrl(video.hlsManifestKey)}
              sourceUrl={cdnUrl(video.sourceKey)}
              sourceMimeType={video.sourceMimeType}
              poster={cdnUrl(video.posterKey)}
            />
          )}

          {/* Description */}
          {project.description && (
            <p
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: '15px',
                color: '#444',
                lineHeight: 1.65,
                margin: '0 0 28px',
              }}
            >
              {project.description}
            </p>
          )}

          {/* Rich text body */}
          {project.body && (
            <div
              style={{
                fontFamily: "'Source Sans 3', 'Source Sans Pro', sans-serif",
                fontSize: '15px',
                color: '#2C2C2A',
                lineHeight: 1.7,
                marginBottom: '32px',
              }}
            >
              <RichText data={project.body} />
            </div>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '4px',
                marginBottom: '32px',
              }}
            >
              {gallery.map((img, i) =>
                img.url ? (
                  <Image
                    key={img.id}
                    src={img.url}
                    alt={`${project.title} gallery ${i + 1}`}
                    width={img.width ?? 300}
                    height={img.height ?? 200}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ) : null,
              )}
            </div>
          )}

          {/* Live URL */}
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 16px',
                height: '32px',
                backgroundColor: '#185FA5',
                color: '#ffffff',
                fontFamily: "'Work Sans', sans-serif",
                fontSize: '12px',
                textDecoration: 'none',
                borderRadius: '2px',
              }}
            >
              View live site ↗
            </a>
          )}
        </div>
      </div>
    </main>
    </>
  )
}
