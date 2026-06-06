/**
 * Normalize a user-entered "live site" URL: require a real web link, tolerate a
 * bare domain by prefixing https://, and reject anything that isn't one — e.g. an
 * email, which otherwise renders as a broken relative link AND even parses as a
 * URL with userinfo (`https://name@gmail.com` -> host `gmail.com`). Returns null
 * when there's nothing safe to link to.
 */
export function normalizeLiveUrl(raw?: string | null): string | null {
  if (!raw) return null
  const v = raw.trim()
  if (!v || v.includes('@')) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}
