import type { CollectionConfig } from 'payload'

const Projects: CollectionConfig = {
  slug: 'projects',
  auth: false,
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
    { name: 'technologies', type: 'array',
      fields: [{ name: 'tech', type: 'text' }] },
    { name: 'liveUrl',     type: 'text',
      admin: { description: 'Link to the live site (optional)' } },
    { name: 'featured',    type: 'checkbox', defaultValue: false,
      admin: { description: 'Show on homepage' } },
    { name: 'publishedAt', type: 'date',     defaultValue: () => new Date().toISOString() },
  ],
}

export default Projects