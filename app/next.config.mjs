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
    remotePatterns: [
      { hostname: 'cdn.builder.io' },
    ],
  },
}

export default withPayload(nextConfig)
