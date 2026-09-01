import { auth } from "@/auth"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { createGoogleDriveOAuthState, googleDriveAuthorizationUrl, googleDriveConfigured } from "@/lib/google-drive"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

function settingsUrl(request: Request, state: string) {
  const url = new URL("/dashboard/settings", request.url)
  url.searchParams.set("storage", state)
  return url
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", request.url))

  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return NextResponse.redirect(settingsUrl(request, "google-drive-owner-required"))
  if (!googleDriveConfigured()) return NextResponse.redirect(settingsUrl(request, "google-drive-config-required"))

  const state = createGoogleDriveOAuthState(workspace.id, session.user.id)
  const response = NextResponse.redirect(googleDriveAuthorizationUrl(state))
  response.cookies.set("frameshare_google_drive_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/storage/google-drive/callback",
    maxAge: 10 * 60,
  })
  return response
}
