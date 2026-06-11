import type { Metadata } from 'next'
import { DM_Sans, Source_Sans_3, Work_Sans } from 'next/font/google'
import '../globals.css'
import { SchemaInjector } from './components/SchemaInjector'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  display: 'swap',
  variable: '--font-dm-sans',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-source-sans',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-work-sans',
})

// Explicit Open Graph tags: without them LinkedIn/Slack/etc. scrape the page
// and pick an arbitrary heading (e.g. a project title) and auto-crop Mark.jpg
// (tall portrait) into a headless card. og-image.jpg is a purpose-built
// 1200x630 (1.91:1) crop of the same photo with the face in frame.
const description =
  'Embedded systems, firmware, electrical engineering, web development, and DevOps — a complete technical partner from prototype to deployment.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://consideratesystems.com'),
  title: 'Mark Musil — Considerate Systems LLC',
  description,
  openGraph: {
    type: 'website',
    siteName: 'Considerate Systems LLC',
    title: 'Mark Musil — Embedded Systems & Software Consultant',
    description,
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Mark Musil, embedded systems and software consultant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mark Musil — Embedded Systems & Software Consultant',
    description,
    images: ['/og-image.jpg'],
  },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sourceSans.variable} ${workSans.variable}`}
    >
      <head>
        <SchemaInjector />
      </head>
      <body>{children}</body>
    </html>
  )
}
