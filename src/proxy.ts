import NextAuth from "next-auth"
import type { NextAuthRequest } from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"
import type { NextFetchEvent, NextRequest } from "next/server"
import { getCanonicalRequestUrl } from "@/lib/canonical-url.mjs"

const { auth } = NextAuth(authConfig)

const authProxy = auth((req: NextAuthRequest, _event: NextFetchEvent) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/prototype")) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
})

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const requestHost =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const canonicalUrl = getCanonicalRequestUrl(
    req.nextUrl,
    process.env.AUTH_URL,
    requestHost
  )
  if (canonicalUrl) return NextResponse.redirect(canonicalUrl)

  return authProxy(req, event)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
