import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { fileURLToPath } from 'url'
import Projects from './collections/Projects.ts'
import Technologies from './collections/Technologies.ts'
import SiteSettings from './collections/SiteSettings.ts'
import Videos from './collections/Videos.ts'
import Advisors from './collections/Advisors.ts'
import Locations from './collections/Locations.ts'

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
    media: {
      prefix: process.env.S3_PREFIX || '',
      // In production, serve media straight from CloudFront (edge-cached) rather
      // than proxying every byte through the app container via /api/media/file —
      // that route ships no Cache-Control and re-streams the object on every hit.
      // `media` read access is already public (`read: () => true`), so dropping
      // the access-control route changes nothing security-wise; it just moves
      // delivery to the CDN. next.config already allow-lists CLOUDFRONT_DOMAIN so
      // next/image can optimize these URLs. Locally (no CloudFront) we keep the
      // proxy route so dev still works against MinIO.
      ...(process.env.CLOUDFRONT_DOMAIN
        ? {
            disablePayloadAccessControl: true,
            generateFileURL: ({ filename, prefix }) =>
              `https://${process.env.CLOUDFRONT_DOMAIN}/${prefix ? `${prefix}/` : ''}${filename}`,
          }
        : {}),
    },
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
  // Extend the editor's default Upload feature so editors can control how an
  // image embedded in rich-text body renders: size + alignment/text-wrap + alt.
  // These per-image values are stored on the lexical upload node's `fields` and
  // applied by a custom JSX converter on the frontend (see projects/[slug]/page).
  // Re-declaring UploadFeature overrides the one already in defaultFeatures (same
  // key, 'upload'), so we keep all other defaults and only customize uploads.
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'alignment',
                type: 'select',
                defaultValue: 'center',
                options: [
                  { label: 'Center', value: 'center' },
                  { label: 'Left (text wraps right)', value: 'left' },
                  { label: 'Right (text wraps left)', value: 'right' },
                  { label: 'Full width', value: 'full' },
                ],
                admin: { description: 'How this image sits relative to the surrounding text.' },
              },
              {
                name: 'size',
                type: 'select',
                defaultValue: 'medium',
                options: [
                  { label: 'Small (25%)', value: 'small' },
                  { label: 'Medium (50%)', value: 'medium' },
                  { label: 'Large (75%)', value: 'large' },
                  { label: 'Original / Full (100%)', value: 'full' },
                ],
                admin: { description: 'Display width, as a fraction of the content column.' },
              },
              {
                name: 'alt',
                type: 'text',
                admin: { description: 'Alt text for accessibility and SEO.' },
              },
              {
                name: 'caption',
                type: 'text',
                admin: { description: 'Optional caption shown beneath the image.' },
              },
            ],
          },
        },
      }),
    ],
  }),
  collections: [
    {
      slug: 'users',
      auth: true,
      fields: [{ name: 'name', type: 'text' }],
    },
    {
      slug: 'media',
      // Media files are served on public pages (hero/title images, body images,
      // video posters). Payload is secure-by-default: without this, `read`
      // requires an authenticated user, so anonymous visitors — and the
      // server-side next/image optimizer (which carries no auth cookie) — get a
      // 403 and the image fails to render. Public read makes media fetchable by
      // everyone while create/update/delete stay admin-only by default.
      access: { read: () => true },
      upload: true,
      fields: [],
    },
    Technologies,
    SiteSettings,
    Videos,
    Projects,
    // CAPTRUST demo collections
    Advisors,
    Locations,
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
