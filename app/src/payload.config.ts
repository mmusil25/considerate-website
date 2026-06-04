import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { fileURLToPath } from 'url'
import Projects from './collections/Projects.ts'
import Technologies from './collections/Technologies.ts'
import SiteSettings from './collections/SiteSettings.ts'
import Videos from './collections/Videos.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Route the `media` collection to S3. This plugin is ALWAYS enabled so the DB
// schema is deterministic — the s3 adapter adds a `prefix` column to `media`,
// and migrations must not depend on runtime env (toggling it per-env would make
// the schema drift between build/migrate and runtime). The platform always has
// an object store: MinIO locally, real S3 in prod — so S3_BUCKET is required.
// This is the prerequisite for treating containers as disposable: media must
// live in S3, not on a replaceable container's disk. See docker/ARCHITECTURE.md.
const s3Plugin = s3Storage({
  collections: {
    // `prefix` lets many sites share one bucket: e.g. "markmusil/", "bakery/"
    media: { prefix: process.env.S3_PREFIX || '' },
  },
  bucket: process.env.S3_BUCKET || '',
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
})

export default buildConfig({
  admin: {
    user: 'users',
    // Custom admin components live in src/components. Resolve component path
    // strings (e.g. "/components/payload/...") relative to this src dir.
    importMap: {
      baseDir: path.resolve(dirname),
    },
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
    Technologies,
    SiteSettings,
    Videos,
    Projects,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL,
      // SSL is required by RDS (prod) but not by a local/MinIO Postgres. Default
      // to on in production, but let any environment opt out with DATABASE_SSL=false
      // so the SAME image runs against local Postgres (compose) and RDS alike.
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
    },
  }),
  plugins: [s3Plugin],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
})
