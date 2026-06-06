import type { CollectionConfig } from 'payload'
import { purge } from '../lib/revalidate'

const Projects: CollectionConfig = {
  slug: 'projects',
  auth: false,
  // Refresh the live (edge-cached) pages when a project is saved or removed, so
  // edits show up without waiting for the CDN's stale-while-revalidate window.
  hooks: {
    afterChange: [
      ({ doc }) =>
        purge({
          paths: [`/projects/${doc.slug}`, '/projects'],
          cdn: [`/projects/${doc.slug}`, '/projects'],
        }),
    ],
    afterDelete: [
      ({ doc }) =>
        purge({
          paths: ['/projects'],
          routes: ['/projects/[slug]'],
          cdn: [`/projects/${doc.slug}`, '/projects'],
        }),
    ],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'publishedAt', 'featured'],
    group: 'Portfolio',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'title',       type: 'text',     required: true },
    { name: 'slug',        type: 'text',     required: true, unique: true,
      admin: { description: 'URL-safe identifier, e.g. "bakery-rebrand"' } },
    { name: 'client',      type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'body',        type: 'richText' },  // full case study content
    { name: 'image',       type: 'upload',   relationTo: 'media' },
    { name: 'gallery',     type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }] },
    { name: 'projectVideo', type: 'relationship', relationTo: 'videos',
      admin: { description: 'Optional video of this project (adaptive HLS, plays on the project page).' } },
    { name: 'technologies', type: 'array',
      fields: [{ name: 'tech', type: 'relationship', relationTo: 'technologies' }] },
    { name: 'liveUrl',     type: 'text',
      admin: { description: 'Link to the live site (optional)' } },
    { name: 'featured',    type: 'checkbox', defaultValue: false,
      admin: { description: 'Show on homepage' } },
    { name: 'publishedAt', type: 'date',     defaultValue: () => new Date().toISOString() },

    // Schema.org Structured Data
    {
      type: 'group',
      name: 'structuredData',
      label: 'Schema.org Structured Data',
      admin: {
        description: 'Configure how search engines and AI interpret this project. Fields auto-map from the content above.',
      },
      fields: [
        {
          name: 'schemaType',
          type: 'select',
          required: true,
          defaultValue: 'CreativeWork',
          options: [
            { label: 'Creative Work (recommended)', value: 'CreativeWork' },
            { label: 'Web Application', value: 'WebApplication' },
            { label: 'Software Source Code', value: 'SoftwareSourceCode' },
            { label: 'Service', value: 'Service' },
          ],
          admin: {
            description: 'Choose the schema type that best describes this project.',
          },
        },
        {
          type: 'ui',
          name: 'schemaDescription',
          admin: {
            components: {
              Field: '/components/payload/SchemaTypeSelector#SchemaTypeSelector',
            },
          },
        },
        {
          type: 'ui',
          name: 'fieldMapper',
          admin: {
            components: {
              Field: '/components/payload/SchemaFieldMapper#SchemaFieldMapper',
            },
          },
        },
        {
          name: 'outcomes',
          type: 'textarea',
          admin: {
            description: 'Quantifiable results or impact (e.g., "Reduced latency by 40%", "Shipped in 2 months")',
          },
        },
        {
          name: 'keywordsFocused',
          type: 'array',
          fields: [
            {
              name: 'keyword',
              type: 'text',
              admin: { description: 'e.g., "React development", "Cloud migration"' },
            },
          ],
          admin: {
            description: 'SEO keywords that describe this project',
          },
        },
        {
          type: 'ui',
          name: 'techStackInfo',
          admin: {
            components: {
              Field: '/components/payload/TechStackSelector#TechStackSelector',
            },
          },
        },
        {
          type: 'ui',
          name: 'jsonldPreview',
          admin: {
            components: {
              Field: '/components/payload/JSONLDPreview#JSONLDPreview',
            },
          },
        },
      ],
    },
  ],
}

export default Projects