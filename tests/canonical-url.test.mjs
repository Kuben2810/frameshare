import assert from "node:assert/strict"
import test from "node:test"

import { getCanonicalRequestUrl } from "../src/lib/canonical-url.mjs"

test("redirects a Vercel deployment URL to the configured auth origin", () => {
  const requestUrl = new URL(
    "https://frameshare-feature.vercel.app/login?from=dashboard"
  )

  const redirectUrl = getCanonicalRequestUrl(
    requestUrl,
    "https://frameshare-feature.vercel.app",
    "frameshare-deployment.vercel.app"
  )

  assert.equal(
    redirectUrl?.href,
    "https://frameshare-feature.vercel.app/login?from=dashboard"
  )
})

test("does not redirect a request that is already on the configured origin", () => {
  const requestUrl = new URL("https://frameshare-feature.vercel.app/login")

  assert.equal(
    getCanonicalRequestUrl(
      requestUrl,
      "https://frameshare-feature.vercel.app"
    ),
    null
  )
})

test("ignores missing or invalid auth URLs", () => {
  const requestUrl = new URL("https://frameshare-deployment.vercel.app/login")

  assert.equal(getCanonicalRequestUrl(requestUrl), null)
  assert.equal(getCanonicalRequestUrl(requestUrl, "not-a-url"), null)
})
