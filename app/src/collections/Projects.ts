import { CollectionConfig } from 'payload';

const Projects: CollectionConfig = {
  slug: 'projects',
  auth: false,
  access: {
    read: async () => true,
    create: async ({ req }) => req.user ? true : false,
    update: async ({ req }) => req.user ? true : false,
    delete: async ({ req }) => req.user ? true : false,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'technologies',
      type: 'array',
      fields: [
        { name: 'tech', type: 'text' },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
};

export default Projects;