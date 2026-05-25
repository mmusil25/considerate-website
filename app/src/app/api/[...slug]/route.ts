import config from '@/payload.config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'

export const GET = REST_GET(config as any)
export const POST = REST_POST(config as any)
export const DELETE = REST_DELETE(config as any)
export const PATCH = REST_PATCH(config as any)
export const PUT = REST_PUT(config as any)
export const OPTIONS = REST_OPTIONS(config as any)
