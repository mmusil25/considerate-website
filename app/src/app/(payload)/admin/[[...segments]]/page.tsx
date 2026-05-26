import configPromise from '@/payload.config'
import { importMap } from '../importMap.js'
import { RootPage } from '@payloadcms/next/views'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

const Page = async ({ params, searchParams }: Args) => {
  await getPayload({ config: configPromise, importMap })
  return RootPage({ config: configPromise, importMap, params, searchParams })
}

export default Page
