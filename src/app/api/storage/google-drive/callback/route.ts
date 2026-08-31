import { auth } from "@/auth"
import { db } from "@/db"
import { storageConnections } from "@/db/schema"
import { ensureActiveWorkspace } from "@/lib/workspace"
import {
  encryptGoogleDriveCredentials,
  exchangeGoogleDriveAuthorizationCode,
  getGoogleDriveUser,
  googleDriveConnectionId,
  verifyGoogleDriveOAuthState,
} from "@/lib/google-drive"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function settingsUrl(request: Request, state: string) {
  const url = new URL("/dashboard/settings", request.url)
  url.searchParams.set("storage", state)
  return url
}

function safeStateMatch(actual: string, expected: string) {
  if (actual.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state")
  const code = request.nextUrl.searchParams.get("code")
  const denied = request.nextUrl.searchParams.get("error")
  const stateCookie = request.cookies.get("frameshare_google_drive_state")?.value
  const session = await auth()

  const clearState = (response: NextResponse) => {
    response.cookies.set("frameshare_google_drive_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/storage/google-drive/callback",
      maxAge: 0,
    })
    return response
  }

  if (!session?.user?.id || !state || !stateCookie || !safeStateMatch(state, stateCookie)) {
    return clearState(NextResponse.redirect(settingsUrl(request, "google-drive-invalid-state")))
  }
  const verifiedState = verifyGoogleDriveOAuthState(state)
  if (!verifiedState || verifiedState.userId !== session.user.id || denied || !code) {
    return clearState(NextResponse.redirect(settingsUrl(request, denied ? "google-drive-cancelled" : "google-drive-invalid-state")))
  }

  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner" || workspace.id !== verifiedState.workspaceId) {
    return clearState(NextResponse.redirect(settingsUrl(request, "google-drive-owner-required")))
  }

  try {
    const tokens = await exchangeGoogleDriveAuthorizationCode(code)
    const user = await getGoogleDriveUser(tokens.accessToken)
    const label = user.emailAddress ? `Google Drive — ${user.emailAddress}` : "Google Drive"
    const now = new Date()
    await db.insert(storageConnections).values({
      id: googleDriveConnectionId(workspace.id),
      workspaceId: workspace.id,
      provider: "google_drive",
      label,
      status: "needs_connection",
      credentialsCiphertext: encryptGoogleDriveCredentials({
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        email: user.emailAddress,
      }),
      lastCheckedAt: now,
      lastError: null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [storageConnections.workspaceId, storageConnections.provider],
      set: {
        label,
        status: "needs_connection",
        rootReference: null,
        credentialsCiphertext: encryptGoogleDriveCredentials({
          refreshToken: tokens.refreshToken,
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: tokens.expiresAt,
          email: user.emailAddress,
        }),
        lastCheckedAt: now,
        lastError: null,
        updatedAt: now,
      },
    })
    return clearState(NextResponse.redirect(settingsUrl(request, "google-drive-connected")))
  } catch {
    return clearState(NextResponse.redirect(settingsUrl(request, "google-drive-error")))
  }
}
