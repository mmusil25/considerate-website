import config from '@/payload.config'
import { RootPage } from '@payloadcms/next/views'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}) {
  const payload = await getPayload({ config: config as any })

  return (
    <RootPage
      config={Promise.resolve(payload.config)}
      importMap={payload.importMap}
      params={params}
      searchParams={searchParams}
    />
  )
}
