import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor, UploadFeature, BlocksFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import Projects from './collections/Projects.ts'
import Technologies from './collections/Technologies.ts'
import SiteSettings from './collections/SiteSettings.ts'
import Videos from './collections/Videos.ts'
import Advisors from './collections/Advisors.ts'
import Locations from './collections/Locations.ts'
import { ALT_TEXT_IMAGE_DESCRIPTION } from './lib/altText.ts'
import { purge } from './lib/revalidate.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Shared visual-decoration options, reused by the single inline image (the
// UploadFeature below) and the Image Grid block, so a "Medium" shadow or "Large"
// radius means the same thing everywhere. The `value`s are keyed into the
// SHADOW_MAP / RADIUS_MAP CSS lookups in src/lib/imageStyle.ts.
const SHADOW_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'Subtle', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Strong', value: 'large' },
]

const RADIUS_OPTIONS = [
  { label: 'None (square)', value: 'none' },
  { label: 'Small (4px)', value: 'small' },
  { label: 'Medium (8px)', value: 'medium' },
  { label: 'Large (16px)', value: 'large' },
  { label: 'Full (pill / circle)', value: 'full' },
]

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
                admin: {
                  description:
                    'Optional — overrides the alt text just for this spot. Leave blank to use the alt text saved on the image itself (which is required).',
                },
              },
              {
                name: 'caption',
                type: 'text',
                admin: { description: 'Optional caption shown beneath the image.' },
              },
              // --- Visual styling -------------------------------------------
              // Stored on the lexical upload node's `fields` (in the body JSON),
              // applied by the `upload` converter via imageDecorStyle(). No DB
              // migration needed — same as alignment/size above.
              {
                name: 'shadow',
                type: 'select',
                defaultValue: 'none',
                options: SHADOW_OPTIONS,
                admin: { description: 'Drop shadow depth behind the image.' },
              },
              {
                name: 'borderRadius',
                type: 'select',
                defaultValue: 'none',
                options: RADIUS_OPTIONS,
                admin: { description: 'Round the image corners.' },
              },
              {
                name: 'borderStyle',
                type: 'select',
                defaultValue: 'none',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'Solid', value: 'solid' },
                  { label: 'Dashed', value: 'dashed' },
                  { label: 'Dotted', value: 'dotted' },
                  { label: 'Double', value: 'double' },
                ],
                admin: { description: 'Outline drawn around the image.' },
              },
              {
                name: 'borderWidth',
                type: 'select',
                defaultValue: 'thin',
                options: [
                  { label: 'Thin (1px)', value: 'thin' },
                  { label: 'Medium (2px)', value: 'medium' },
                  { label: 'Thick (4px)', value: 'thick' },
                ],
                admin: {
                  description: 'Border thickness (only applies when a border style is set).',
                  condition: (_data, siblingData) =>
                    !!siblingData?.borderStyle && siblingData.borderStyle !== 'none',
                },
              },
              {
                name: 'borderColor',
                type: 'text',
                defaultValue: '#2C2C2A',
                admin: {
                  description: 'Border color — any CSS color, e.g. "#185FA5" (only applies when a border style is set).',
                  condition: (_data, siblingData) =>
                    !!siblingData?.borderStyle && siblingData.borderStyle !== 'none',
                },
              },
            ],
          },
        },
      }),
      // Inline video clips: drop a Video block anywhere in a project body and
      // reference a doc from the `videos` collection (pick an existing clip or
      // create+upload a new one inline). The frontend converter renders it with
      // the same adaptive <VideoPlayer> (HLS) used for the main project video,
      // so projects with multiple short clips stream them all. Block data lives
      // inside the lexical body JSON — no separate table, so no DB migration.
      BlocksFeature({
        blocks: [
          {
            slug: 'video',
            interfaceName: 'InlineVideoBlock',
            labels: { singular: 'Video', plural: 'Videos' },
            fields: [
              {
                name: 'video',
                type: 'relationship',
                relationTo: 'videos',
                required: true,
                admin: { description: 'Pick a clip, or create + upload a new one inline.' },
              },
              {
                name: 'caption',
                type: 'text',
                admin: { description: 'Optional caption shown beneath the clip.' },
              },
            ],
          },
          // Image Grid: a dynamic, responsive gallery of images dropped anywhere
          // in a project body. Like the video block, all data (the image refs +
          // layout choices) lives inside the lexical body JSON — no separate
          // table, so no DB migration. Rendered by the `imageGrid` converter ->
          // <ImageGrid> component.
          {
            slug: 'imageGrid',
            interfaceName: 'ImageGridBlock',
            labels: { singular: 'Image Grid', plural: 'Image Grids' },
            fields: [
              {
                name: 'images',
                type: 'array',
                minRows: 1,
                required: true,
                labels: { singular: 'Image', plural: 'Images' },
                admin: { description: 'Add images and drag to reorder. They flow into the grid left-to-right.' },
                fields: [
                  {
                    name: 'image',
                    type: 'upload',
                    relationTo: 'media',
                    required: true,
                  },
                  {
                    name: 'alt',
                    type: 'text',
                    admin: {
                      description:
                        'Optional — overrides the alt text just for this cell. Leave blank to use the alt text saved on the image itself (which is required).',
                    },
                  },
                  {
                    name: 'caption',
                    type: 'text',
                    admin: { description: 'Optional caption shown beneath this image.' },
                  },
                ],
              },
              {
                name: 'columns',
                type: 'select',
                defaultValue: 'auto',
                options: [
                  { label: 'Auto-fit (~180px each)', value: 'auto' },
                  { label: '2 columns', value: '2' },
                  { label: '3 columns', value: '3' },
                  { label: '4 columns', value: '4' },
                ],
                admin: { description: 'How many columns the grid uses. "Auto-fit" packs as many as the width allows.' },
              },
              {
                name: 'gap',
                type: 'select',
                defaultValue: 'small',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'Small (8px)', value: 'small' },
                  { label: 'Medium (16px)', value: 'medium' },
                  { label: 'Large (24px)', value: 'large' },
                ],
                admin: { description: 'Spacing between images.' },
              },
              {
                name: 'aspectRatio',
                type: 'select',
                defaultValue: 'auto',
                options: [
                  { label: 'Natural (no crop)', value: 'auto' },
                  { label: 'Square (1:1)', value: 'square' },
                  { label: 'Landscape (4:3)', value: 'landscape' },
                  { label: 'Wide (16:9)', value: 'wide' },
                  { label: 'Portrait (3:4)', value: 'portrait' },
                ],
                admin: { description: 'Crop every cell to a uniform shape, or keep each image’s natural proportions.' },
              },
              {
                name: 'borderRadius',
                type: 'select',
                defaultValue: 'none',
                options: RADIUS_OPTIONS,
                admin: { description: 'Round the corners of every image in the grid.' },
              },
              {
                name: 'shadow',
                type: 'select',
                defaultValue: 'none',
                options: SHADOW_OPTIONS,
                admin: { description: 'Drop shadow depth behind every image in the grid.' },
              },
            ],
          },
        ],
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
      // A re-crop / re-upload overwrites the SAME S3 key, so its URL is stable
      // and every cache in front of it would keep serving the old bytes. On any
      // media change: refresh the pages that may embed it (we don't track which,
      // so purge them broadly, like the Videos hook) AND invalidate this exact
      // object on the media CloudFront distribution — that distro ignores query
      // strings, so the `?v=` token from mediaUrl() can't bust its edge copy.
      hooks: {
        afterChange: [
          ({ doc }) => {
            const key = `/${doc.prefix ? `${doc.prefix}/` : ''}${doc.filename}`
            return purge({
              paths: ['/', '/projects', '/demos/financial/advisor', '/demos/financial/location'],
              routes: ['/projects/[slug]'],
              cdn: ['/', '/projects', '/projects/*', '/demos/*'],
              assetsCdn: [key],
            })
          },
        ],
      },
      // Alt text is REQUIRED on every uploaded asset — it's the single source of
      // truth that every render site (hero/gallery/headshot/logo + inline body
      // images and grids) falls back to. The per-placement `alt` fields on the
      // rich-text upload node and the Image Grid block are optional overrides of
      // this value. See lib/altText.ts for the editor-facing explanation.
      fields: [
        {
          name: 'alt',
          type: 'text',
          required: true,
          admin: { description: ALT_TEXT_IMAGE_DESCRIPTION },
        },
      ],
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
  // Image processor. REQUIRED for the admin crop/focal-point tools to actually
  // produce output: Payload only runs the crop when `sharp` is present on the
  // config (see node_modules/payload/dist/uploads/generateFileData.js — the
  // `if (cropData && sharp)` branch). Without it the crop UI moves but the saved
  // file is the uncropped original. We define no `imageSizes`, so a manual crop
  // is written back as the main file (the frontend serves the original via
  // next/image), which is exactly what we want. sharp is already a dependency
  // (Next also uses it for image optimization), so it's present at runtime.
  sharp,
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
})
