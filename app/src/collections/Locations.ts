import type { CollectionConfig } from 'payload'
import { purgeByPolicy } from '../lib/revalidate'

// Both demo directory pages refresh together: advisor cards link their office,
// so a location edit changes both.
const DEMO_PAGES = {
  paths: ['/demos/financial/advisor', '/demos/financial/location'],
  cdn: ['/demos/financial/advisor', '/demos/financial/location'],
}

// CAPTRUST demo — an office location. Advisors point at a location via their
// `location` relationship; the `employees` join below reads that back so a
// location automatically lists the advisors who work there (no double entry).
const Locations: CollectionConfig = {
  slug: 'locations',
  auth: false,
  // Refresh the live directory pages on save/delete, per the editor-chosen
  // policy in Settings → Cache (cache-control global).
  hooks: {
    afterChange: [({ req }) => purgeByPolicy(req.payload, 'locations', DEMO_PAGES)],
    afterDelete: [({ req }) => purgeByPolicy(req.payload, 'locations', DEMO_PAGES)],
  },
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
    // Quick jump from the editor to the live location directory (sidebar).
    // UI-only, no DB column. See components/payload/ViewPageLink.tsx.
    {
      type: 'ui',
      name: 'viewPageLink',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/payload/ViewPageLink#ViewPageLink' },
      },
    },
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
