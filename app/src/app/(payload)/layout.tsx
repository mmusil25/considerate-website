// app/src/app/(payload)/layout.tsx
// Required by Payload v3: wraps the /admin route group with Payload's RootLayout,
// which sets up the server-side config context that RootPage/views depend on.
// Without this, admin pages fall back to the plain root layout and 500 with
// "Cannot destructure property 'config'/'routes'".
import type { ServerFunctionClient } from 'payload'
import config from '@/payload.config'
import '@payloadcms/next/css'
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './admin/importMap.js'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
