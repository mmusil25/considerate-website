import type { Metadata } from 'next'
import { DM_Sans, Source_Sans_3, Work_Sans } from 'next/font/google'
import '../globals.css'

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

export const metadata: Metadata = {
  title: 'Mark Musil — Considerate Systems LLC',
  description:
    'Embedded systems, firmware, electrical engineering, web development, and DevOps — a complete technical partner from prototype to deployment.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sourceSans.variable} ${workSans.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
