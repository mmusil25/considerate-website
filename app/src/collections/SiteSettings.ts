import type { CollectionConfig } from 'payload'

const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  auth: false,
  admin: {
    useAsTitle: 'organizationName',
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
      type: 'tabs',
      tabs: [
        {
          label: 'Organization',
          fields: [
            {
              name: 'organizationName',
              type: 'text',
              required: true,
              admin: { description: 'e.g., "Considerate Systems LLC"' },
            },
            {
              name: 'organizationDescription',
              type: 'textarea',
              admin: { description: 'What does your organization do?' },
            },
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Organization logo (for schema.org and social)' },
            },
            {
              name: 'foundingDate',
              type: 'date',
              admin: { description: 'When was the organization founded?' },
            },
            {
              name: 'address',
              type: 'text',
              admin: { description: 'Physical address or location' },
            },
            {
              name: 'email',
              type: 'email',
              admin: { description: 'Contact email address' },
            },
            {
              name: 'telephone',
              type: 'text',
              admin: { description: 'Contact phone number' },
            },
          ],
        },
        {
          label: 'Person (Founder)',
          fields: [
            {
              name: 'personGivenName',
              type: 'text',
              required: true,
              admin: { description: 'First name, e.g., "Mark"' },
            },
            {
              name: 'personFamilyName',
              type: 'text',
              required: true,
              admin: { description: 'Last name, e.g., "Musil"' },
            },
            {
              name: 'personJobTitle',
              type: 'text',
              admin: { description: 'e.g., "Founder & Principal Consultant"' },
            },
            {
              name: 'personBio',
              type: 'textarea',
              admin: { description: 'Professional bio (2-3 sentences)' },
            },
            {
              name: 'personImage',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Professional headshot or photo' },
            },
            {
              name: 'personExpertise',
              type: 'relationship',
              relationTo: 'technologies',
              hasMany: true,
              admin: { description: 'Select core expertise/technologies' },
            },
            {
              name: 'linkedinUrl',
              type: 'text',
              admin: { description: 'LinkedIn profile URL (optional)' },
            },
            {
              name: 'githubUrl',
              type: 'text',
              admin: { description: 'GitHub profile URL (optional)' },
            },
          ],
        },
        {
          label: 'Services',
          fields: [
            {
              name: 'hourlyRate',
              type: 'text',
              admin: { description: 'e.g., "$120/hr" - for schema.org Offer' },
            },
            {
              name: 'availabilityStatus',
              type: 'select',
              options: [
                { label: 'Available', value: 'available' },
                { label: 'Limited Availability', value: 'limited' },
                { label: 'Not Available', value: 'unavailable' },
              ],
              defaultValue: 'available',
              admin: { description: 'Current availability for new projects' },
            },
          ],
        },
      ],
    },
  ],
}

export default SiteSettings
