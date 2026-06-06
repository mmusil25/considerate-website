import type { CollectionConfig } from 'payload'

// CAPTRUST demo — an office location. Advisors point at a location via their
// `location` relationship; the `employees` join below reads that back so a
// location automatically lists the advisors who work there (no double entry).
const Locations: CollectionConfig = {
  slug: 'locations',
  auth: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'address'],
    group: 'CAPTRUST demo',
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
      admin: { description: 'Office name, e.g. "Raleigh Headquarters"' },
    },
    {
      name: 'address',
      type: 'textarea',
      admin: { description: 'Full street address' },
    },
    {
      type: 'group',
      name: 'coordinates',
      label: 'GPS Coordinates',
      fields: [
        { name: 'latitude', type: 'number', admin: { description: 'e.g. 35.7796' } },
        { name: 'longitude', type: 'number', admin: { description: 'e.g. -78.6382' } },
      ],
    },
    { name: 'officeImage', type: 'upload', relationTo: 'media' },
    // Reverse reference: advisors whose `location` points at this doc.
    // Read-only and auto-populated — this is the "links back to advisor" side.
    { name: 'employees', type: 'join', collection: 'advisors', on: 'location' },
  ],
}

export default Locations
