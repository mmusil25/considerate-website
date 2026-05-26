// app/src/app/(payload)/admin/[[...segments]]/not-found.tsx
// Must pass config/importMap/params to NotFoundPage (matching the Payload v3
// template). A bare `export { NotFoundPage as default }` renders the view with
// an empty config, throwing "Cannot destructure property 'routes' of '{}'".
import type { Metadata } from 'next'
import config from '@/payload.config'
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap.js'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const NotFound = ({ params, searchParams }: Args) =>
  NotFoundPage({ config, params, searchParams, importMap })

export default NotFound
