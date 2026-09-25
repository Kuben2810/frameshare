/**
 * Keep browser navigation on the origin Auth.js uses for OAuth callbacks.
 * PKCE cookies are host-only, so starting OAuth on a Vercel deployment URL
 * and returning to a configured alias makes the verifier unavailable.
 *
 * @param {URL} requestUrl
 * @param {string | undefined} configuredAuthUrl
 * @param {string | null} [requestHost]
 * @returns {URL | null}
 */
export function getCanonicalRequestUrl(
  requestUrl,
  configuredAuthUrl,
  requestHost = requestUrl.host
) {
  if (!configuredAuthUrl) return null

  try {
    const canonicalUrl = new URL(configuredAuthUrl)
    const incomingHost = requestHost?.split(",", 1)[0].trim().toLowerCase()
    if (!incomingHost || incomingHost === canonicalUrl.host.toLowerCase()) return null

    return new URL(
      `${requestUrl.pathname}${requestUrl.search}`,
      canonicalUrl.origin
    )
  } catch {
    return null
  }
}
