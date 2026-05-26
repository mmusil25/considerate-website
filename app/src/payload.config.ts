import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { fileURLToPath } from 'url'
import Projects from './collections/Projects.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Route the `media` collection to S3 ONLY when a bucket is configured. Without
// S3_BUCKET (e.g. local dev), the plugin is omitted and Payload falls back to
// local-disk storage — so this change is inert until a site is given S3 env.
// This is the prerequisite for treating containers as disposable: media must
// live in S3, not on a replaceable container's disk. See docker/ARCHITECTURE.md.
const s3Plugins = process.env.S3_BUCKET
  ? [
      s3Storage({
        collections: {
          // `prefix` lets many sites share one bucket: e.g. "markmusil/", "bakery/"
          media: { prefix: process.env.S3_PREFIX || '' },
        },
        bucket: process.env.S3_BUCKET,
        config: {
          region: process.env.AWS_REGION || 'us-east-2',
          // In AWS, prefer an IAM instance/task role over static keys; these envs
          // are the fallback for local dev (MinIO) and non-AWS environments.
          ...(process.env.AWS_ACCESS_KEY_ID && {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
          }),
          // endpoint + forcePathStyle let the SAME code talk to MinIO locally.
          ...(process.env.S3_ENDPOINT && {
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true,
          }),
        },
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: 'users',
  },
  editor: lexicalEditor(),
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [{ name: 'name', type: 'text' }],
    },
    {
      slug: 'media',
      upload: true,
      fields: [],
    },
    Projects,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    },
  }),
  plugins: [...s3Plugins],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
})
