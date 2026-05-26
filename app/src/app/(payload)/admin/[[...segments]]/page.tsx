import config from '@/payload.config'
import { importMap } from '../importMap.js'
import { RootPage } from '@payloadcms/next/views'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const Page = ({ params, searchParams }: Args) =>
  RootPage({ config, importMap, params, searchParams })

export default Page
