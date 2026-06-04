import { getPayload } from 'payload'
import config from '@/payload.config'
import { generateOrganizationJSONLD, generatePersonJSONLD, serializeJsonLD } from '@/lib/schema'

export async function SchemaInjector() {
  try {
    const payload = await getPayload({ config })
    const { docs: settingsList } = await payload.find({
      collection: 'site-settings',
      depth: 2,
      limit: 1,
    })

    const settings = settingsList[0] as any
    if (!settings) return null

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://considerate-systems.com'

    const orgJsonld = generateOrganizationJSONLD(settings, baseUrl)
    const personJsonld = generatePersonJSONLD(settings)

    // Combine into a graph
    const combinedJsonld = {
      '@context': 'https://schema.org',
      '@graph': [orgJsonld, personJsonld],
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLD(combinedJsonld),
          }}
        />
      </>
    )
  } catch (error) {
    // Silently fail if SiteSettings doesn't exist yet
    console.debug('SchemaInjector: Could not load SiteSettings', error)
    return null
  }
}
