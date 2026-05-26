import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // ships only the node_modules the server actually needs (~150 MB) instead of
  // the full tree (~1 GB+). The docker/Dockerfile runner stage relies on this.
  output: 'standalone',
  images: {
    remotePatterns: [
      { hostname: 'cdn.builder.io' },
      // When media is served via CloudFront, add the site's distribution domain
      // so Next can optimize S3-hosted images, e.g.:
      // { hostname: 'd23c3aaj86r78z.cloudfront.net' },
    ],
  },
}

export default withPayload(nextConfig)
