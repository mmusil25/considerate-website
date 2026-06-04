import type { Project, Technology, SiteSetting, Media } from '../../payload-types'

export type SchemaType = 'CreativeWork' | 'WebApplication' | 'SoftwareSourceCode' | 'Service'

export const SCHEMA_DESCRIPTIONS: Record<SchemaType, { title: string; description: string; url: string }> = {
  CreativeWork: {
    title: 'Creative Work',
    description: 'A general work of creative expression (article, design, case study, etc.). Use this for portfolio work that doesn\'t fit other categories.',
    url: 'https://schema.org/CreativeWork',
  },
  WebApplication: {
    title: 'Web Application',
    description: 'A web-based software application. Use when the project is an interactive web app or SaaS platform.',
    url: 'https://schema.org/WebApplication',
  },
  SoftwareSourceCode: {
    title: 'Software Source Code',
    description: 'Source code or a code repository. Use when the project is open-source or code-focused.',
    url: 'https://schema.org/SoftwareSourceCode',
  },
  Service: {
    title: 'Service',
    description: 'A service offering (consulting, development, etc.). Use when describing a service engagement.',
    url: 'https://schema.org/Service',
  },
}

interface ProjectJSONLD {
  '@context': string
  '@type': string
  name: string
  description?: string
  image?: string
  datePublished?: string
  author?: {
    '@type': 'Person' | 'Organization'
    name: string
  }
  url?: string
  mentions?: Array<{ '@type': string; name: string; url?: string }>
  text?: string
  [key: string]: unknown
}

interface OrganizationJSONLD {
  '@context': string
  '@type': 'Organization'
  name: string
  url?: string
  logo?: string
  description?: string
  founder?: {
    '@type': 'Person'
    name: string
  }
  email?: string
  telephone?: string
  address?: {
    '@type': 'PostalAddress'
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    postalCode?: string
    addressCountry?: string
  }
}

interface PersonJSONLD {
  '@context': string
  '@type': 'Person'
  name: string
  givenName?: string
  familyName?: string
  image?: string
  jobTitle?: string
  description?: string
  expertise?: Array<{ '@type': 'Thing'; name: string }>
  sameAs?: string[]
  url?: string
}

/**
 * Generate JSON-LD for a project
 */
export function generateProjectJSONLD(
  project: Project,
  baseUrl: string,
  schemaType?: SchemaType,
  siteSettings?: SiteSetting,
): ProjectJSONLD {
  const type = schemaType || 'CreativeWork'
  const imageUrl = typeof project.image === 'object' ? project.image?.url : null

  const jsonld: ProjectJSONLD = {
    '@context': 'https://schema.org',
    '@type': type,
    name: project.title,
  }

  if (project.description) jsonld.description = project.description
  if (imageUrl) jsonld.image = imageUrl
  if (project.publishedAt) jsonld.datePublished = new Date(project.publishedAt).toISOString().split('T')[0]
  if (project.liveUrl) jsonld.url = project.liveUrl

  // Author - prefer organization if available, fallback to person
  if (siteSettings) {
    jsonld.author = {
      '@type': 'Organization',
      name: siteSettings.organizationName || 'Considerate Systems LLC',
    }
  } else if (project.client) {
    jsonld.author = {
      '@type': 'Organization',
      name: project.client,
    }
  }

  // Technologies as structured mentions
  if (project.technologies && project.technologies.length > 0) {
    jsonld.mentions = project.technologies
      .map((t) => {
        const tech = typeof t.tech === 'object' ? t.tech : null
        if (!tech) return null
        return {
          '@type': 'Thing',
          name: typeof tech === 'string' ? tech : tech.name || '',
          ...(typeof tech === 'object' && tech.url && { url: tech.url }),
        }
      })
      .filter(Boolean) as Array<{ '@type': string; name: string; url?: string }>
  }

  // Add rich text body for CreativeWork
  if (project.body && type === 'CreativeWork') {
    jsonld.text = extractTextFromLexical(project.body)
  }

  return jsonld
}

/**
 * Generate JSON-LD for the organization
 */
export function generateOrganizationJSONLD(settings: SiteSetting, baseUrl: string): OrganizationJSONLD {
  const logoUrl = typeof settings.logo === 'object' ? settings.logo?.url : null

  const jsonld: OrganizationJSONLD = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings.organizationName,
    url: baseUrl,
  }

  if (logoUrl) jsonld.logo = logoUrl
  if (settings.organizationDescription) jsonld.description = settings.organizationDescription
  if (settings.email) jsonld.email = settings.email
  if (settings.telephone) jsonld.telephone = settings.telephone

  // Founder reference
  if (settings.personGivenName && settings.personFamilyName) {
    jsonld.founder = {
      '@type': 'Person',
      name: `${settings.personGivenName} ${settings.personFamilyName}`,
    }
  }

  return jsonld
}

/**
 * Generate JSON-LD for the person (founder)
 */
export function generatePersonJSONLD(settings: SiteSetting): PersonJSONLD {
  const imageUrl = typeof settings.personImage === 'object' ? settings.personImage?.url : null

  const jsonld: PersonJSONLD = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${settings.personGivenName || ''} ${settings.personFamilyName || ''}`.trim(),
  }

  if (settings.personGivenName) jsonld.givenName = settings.personGivenName
  if (settings.personFamilyName) jsonld.familyName = settings.personFamilyName
  if (imageUrl) jsonld.image = imageUrl
  if (settings.personJobTitle) jsonld.jobTitle = settings.personJobTitle
  if (settings.personBio) jsonld.description = settings.personBio

  // Expertise as array of Things
  if (settings.personExpertise && settings.personExpertise.length > 0) {
    jsonld.expertise = settings.personExpertise
      .map((tech) => {
        const techObj = typeof tech === 'object' ? tech : null
        if (!techObj) return null
        return {
          '@type': 'Thing',
          name: techObj.name || '',
        }
      })
      .filter(Boolean) as Array<{ '@type': 'Thing'; name: string }>
  }

  // Social profiles
  const sameAs: string[] = []
  if (settings.linkedinUrl) sameAs.push(settings.linkedinUrl)
  if (settings.githubUrl) sameAs.push(settings.githubUrl)
  if (sameAs.length > 0) jsonld.sameAs = sameAs

  return jsonld
}

/**
 * Escape and serialize JSON-LD for safe HTML injection
 */
export function serializeJsonLD(jsonld: Record<string, unknown>): string {
  const jsonString = JSON.stringify(jsonld)
  // Escape closing script tags to prevent breaking HTML
  return jsonString.replace(/<\/script>/gi, '<\\/script>')
}

/**
 * Extract plain text from Lexical rich text editor output
 * This is a simple implementation; adjust based on your Lexical structure
 */
function extractTextFromLexical(
  lexicalData: unknown,
): string {
  if (!lexicalData || typeof lexicalData !== 'object') return ''

  const data = lexicalData as Record<string, unknown>
  if (!data.root || typeof data.root !== 'object') return ''

  const root = data.root as Record<string, unknown>
  const children = root.children as unknown[]
  if (!Array.isArray(children)) return ''

  return children
    .map((node) => {
      if (typeof node !== 'object' || !node) return ''
      const n = node as Record<string, unknown>
      if (Array.isArray(n.children)) {
        return (n.children as unknown[])
          .map((child) => {
            if (typeof child === 'object' && child) {
              const c = child as Record<string, unknown>
              if (typeof c.text === 'string') return c.text
            }
            return ''
          })
          .join('')
      }
      return ''
    })
    .filter(Boolean)
    .join(' ')
}

/**
 * Schema type options for the dropdown
 */
export const SCHEMA_TYPE_OPTIONS = Object.entries(SCHEMA_DESCRIPTIONS).map(([value, { title }]) => ({
  label: title,
  value: value as SchemaType,
}))
