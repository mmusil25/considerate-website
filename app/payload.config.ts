import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import Projects from './src/collections/Projects'

const Media = {
  slug: 'media',
  upload: {
    staticURL: '/media',
    staticDir: path.resolve(__dirname, '../public/media'),
    mimeTypes: ['image/*'],
  },
  fields: [],
}

const Users = {
  slug: 'users',
  auth: true,
  fields: [
    { name: 'name', type: 'text' },
  ],
}

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
  admin: {
    user: 'users',
  },
  editor: lexicalEditor(),
  collections: [Users, Media, Projects],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
})
