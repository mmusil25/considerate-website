import type { CollectionConfig } from 'payload'

const Technologies: CollectionConfig = {
  slug: 'technologies',
  auth: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'url'],
    group: 'SEO & Content',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'e.g., "React", "Node.js", "AWS"' },
    },
    {
      name: 'url',
      type: 'text',
      admin: { description: 'Official website or documentation (optional)' },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Language', value: 'language' },
        { label: 'Framework', value: 'framework' },
        { label: 'Tool', value: 'tool' },
        { label: 'Platform', value: 'platform' },
        { label: 'Database', value: 'database' },
        { label: 'Service', value: 'service' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Categorize the technology for filtering' },
    },
  ],
}

export default Technologies
