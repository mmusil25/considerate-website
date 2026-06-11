import type { CollectionConfig } from 'payload'

/**
 * Contact-form submissions. Created ONLY by the server action on /contact
 * (Local API with overrideAccess) — `create: () => false` keeps the public
 * REST API from being a spam vector. Submissions are stored even when the
 * email notification fails, so the inbox is the alert and the admin is the
 * source of truth.
 */
const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  labels: { singular: 'Contact Submission', plural: 'Contact Submissions' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'name', 'email', 'status', 'createdAt'],
    description: 'Messages from the /contact form. Reply directly from your mail client — the sender address is in each entry.',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: () => false,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
    {
      name: 'status',
      type: 'select',
      options: ['new', 'replied', 'archived', 'spam'],
      defaultValue: 'new',
      admin: { position: 'sidebar' },
    },
    // Captured for the per-IP rate limit and spam triage; not shown prominently.
    { name: 'ip', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { position: 'sidebar', readOnly: true } },
  ],
}

export default ContactSubmissions
