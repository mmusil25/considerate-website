import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mark Musil',
  description: 'Small business website',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
