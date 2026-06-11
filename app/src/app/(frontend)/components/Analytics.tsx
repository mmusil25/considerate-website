/**
 * Privacy-friendly analytics (Plausible-compatible: Plausible Cloud, self-hosted
 * Plausible, or Umami via ANALYTICS_SCRIPT_SRC). Cookieless, so no consent
 * banner is required. Rendered server-side and gated on runtime env — flipping
 * it on is a Terraform env change (analytics_domain), no rebuild:
 *   ANALYTICS_DOMAIN      e.g. "consideratesystems.com" (off when unset)
 *   ANALYTICS_SCRIPT_SRC  optional, defaults to Plausible Cloud's script
 */
export function Analytics() {
  const domain = process.env.ANALYTICS_DOMAIN
  if (!domain) return null
  const src = process.env.ANALYTICS_SCRIPT_SRC || 'https://plausible.io/js/script.js'
  return <script defer data-domain={domain} src={src} />
}
