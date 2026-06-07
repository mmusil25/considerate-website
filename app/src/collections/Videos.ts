import type { CollectionConfig } from 'payload'
import { purge } from '../lib/revalidate'
import { ALT_TEXT_VIDEO_DESCRIPTION } from '../lib/altText'

/**
 * Videos are NOT a Payload `upload` collection. The source files are 4K60 multi-GB
 * originals uploaded *directly to S3* from the browser (presigned multipart),
 * bypassing the Fargate server. This collection only stores the resulting S3 keys
 * and transcode state; the heavy lifting happens in the S3 → Lambda → MediaConvert
 * pipeline (see videomgmt.md). The frontend builds CloudFront URLs from these keys.
 */
const Videos: CollectionConfig = {
  slug: 'videos',
  auth: false,
  // When a video changes — including the transcode pipeline flipping status to
  // `ready` via the callback — refresh the project pages that may embed it.
  // We don't track which projects reference a clip, so purge them broadly.
  hooks: {
    afterChange: [
      () => purge({ paths: ['/projects'], routes: ['/projects/[slug]'], cdn: ['/projects', '/projects/*'] }),
    ],
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'updatedAt'],
    group: 'SEO & Content',
    description:
      'High-quality video, transcoded to adaptive HLS. Upload a source file and the pipeline produces a streaming ladder capped at the source quality.',
  },
  access: {
    // Public read so the frontend can resolve HLS/poster keys for playback.
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Internal label, e.g. "Bakery build timelapse"' },
    },
    {
      // Required for accessibility — used as the player's accessible name
      // (aria-label) on the public page. See lib/altText.ts.
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: ALT_TEXT_VIDEO_DESCRIPTION },
    },
    // --- Presentation controls (how the clip displays on the page) ---
    {
      type: 'row',
      fields: [
        {
          name: 'displaySize',
          type: 'select',
          defaultValue: 'full',
          options: [
            { label: 'Small (240px)', value: 'small' },
            { label: 'Medium (400px)', value: 'medium' },
            { label: 'Large (640px)', value: 'large' },
            { label: 'Full width', value: 'full' },
          ],
          admin: {
            width: '50%',
            description: 'Display width. Portrait (phone) clips look best at Small or Medium.',
          },
        },
        {
          name: 'displayAlignment',
          type: 'select',
          defaultValue: 'center',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left', value: 'left' },
            { label: 'Right', value: 'right' },
          ],
          admin: { width: '50%', description: 'Horizontal placement within the column.' },
        },
      ],
    },
    {
      name: 'removeAudio',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Remove the audio track — produces a silent video. Useful for workshop clips where the only sound is computer fans or background noise. Audio is stripped during transcoding, so set this BEFORE uploading the source. To change it on an existing clip, re-upload the source.',
      },
    },
    {
      // The custom uploader drives the whole direct-to-S3 flow and writes the keys
      // below via the API routes. It renders above the data fields.
      type: 'ui',
      name: 'uploader',
      admin: {
        components: {
          Field: '/components/payload/VideoUploader#VideoUploader',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'empty',
      options: [
        { label: 'No source yet', value: 'empty' },
        { label: 'Uploading', value: 'uploading' },
        { label: 'Processing (transcoding)', value: 'processing' },
        { label: 'Ready', value: 'ready' },
        { label: 'Error', value: 'error' },
      ],
      admin: {
        description: 'Set automatically by the upload + transcode pipeline.',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'sourceKey',
      type: 'text',
      admin: {
        description: 'S3 key of the archived original (ceiling-quality playback).',
        readOnly: true,
      },
    },
    {
      name: 'sourceMimeType',
      type: 'text',
      admin: {
        description: 'MIME type of the original, used by the player to feature-detect direct playback.',
        readOnly: true,
      },
    },
    {
      name: 'hlsManifestKey',
      type: 'text',
      admin: {
        description: 'S3 key of the HLS master manifest (index.m3u8). Set when transcode completes.',
        readOnly: true,
      },
    },
    {
      name: 'posterKey',
      type: 'text',
      admin: {
        description: 'S3 key of the poster/thumbnail frame.',
        readOnly: true,
      },
    },
    {
      name: 'mediaConvertJobId',
      type: 'text',
      admin: { description: 'MediaConvert job id (for debugging).', readOnly: true },
    },
    {
      name: 'durationMs',
      type: 'number',
      admin: { description: 'Duration in milliseconds.', readOnly: true },
    },
    {
      name: 'width',
      type: 'number',
      admin: { description: 'Source width (px). The ladder never upscales beyond this.', readOnly: true },
    },
    {
      name: 'height',
      type: 'number',
      admin: { description: 'Source height (px).', readOnly: true },
    },
    {
      name: 'errorMessage',
      type: 'textarea',
      admin: { description: 'Populated if transcoding failed.', readOnly: true },
    },
  ],
}

export default Videos
