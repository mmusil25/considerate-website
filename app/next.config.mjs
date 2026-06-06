import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Tells browsers to always use HTTPS — eliminates the HTTP→HTTPS
          // redirect round-trip on repeat visits (Lighthouse "multiple redirects").
          // 2-year max-age is the recommended value for HSTS preload submission.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },

  webpack: (config) => {
    config.watchOptions = {
      ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
    }
    return config
  },

  images: {
    // Prefer AVIF (smaller than WebP), fall back to WebP; the optimizer picks per
    // the browser's Accept header. CloudFront's image cache behavior includes
    // Accept in its key, so each format is cached separately at the edge.
    formats: ['image/avif', 'image/webp'],
    // How long an optimized variant stays valid. The default (60s) made the
    // optimizer emit `Cache-Control: max-age=60`, so variants barely cached. A
    // year lets browsers and CloudFront hold them; source filenames are
    // effectively immutable (Payload suffixes duplicates), so this is safe.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { hostname: 'cdn.builder.io' },
      // Video posters and all uploaded media are served via CloudFront. NOTE:
      // remotePatterns is frozen into the optimizer config at BUILD time, and the
      // build container has no CLOUDFRONT_DOMAIN — referencing it here baked the
      // literal fallback and made the optimizer reject every media URL with
      // "url parameter is not allowed" (HTTP 400). A build-time-static wildcard
      // for the CloudFront domain avoids that env coupling entirely.
      { protocol: 'https', hostname: '*.cloudfront.net' },
    ],
  },
}

export default withPayload(nextConfig)
