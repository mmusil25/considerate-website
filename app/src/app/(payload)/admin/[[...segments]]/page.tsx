import config from '@/payload.config'
import { importMap } from '../importMap.js'
import { RootPage } from '@payloadcms/next/views'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const Page = async ({ params, searchParams }: Args) => {
  const resolved = await config
  console.log('[admin] config type:', typeof resolved)
  console.log('[admin] admin keys:', Object.keys(resolved?.admin || {}))
  console.log('[admin] admin.routes:', resolved?.admin?.routes)
  console.log('[admin] routes:', resolved?.routes)
  return RootPage({ config, importMap, params, searchParams })
}

export default Page
