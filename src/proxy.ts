import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/prototype")) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/prototype/:path*", "/login", "/register"],
}
