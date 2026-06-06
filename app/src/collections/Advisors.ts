import type { CollectionConfig } from 'payload'

// CAPTRUST demo — a financial advisor. References a single office `location`;
// the Locations collection reads this back via its `employees` join field.
const Advisors: CollectionConfig = {
  slug: 'advisors',
  auth: false,
  admin: {
    useAsTitle: 'lastName',
    defaultColumns: ['firstName', 'lastName', 'location'],
    group: 'CAPTRUST demo',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text', required: true },
    { name: 'headshot', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'richText' },
    {
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      admin: { description: 'The office this advisor works from' },
    },
  ],
}

export default Advisors
