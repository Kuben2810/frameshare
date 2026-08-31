import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto"
import { db } from "@/db"
import { storageConnections } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

type GoogleDriveConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  pickerApiKey: string
}

export type GoogleDriveCredentials = {
  refreshToken: string
  accessToken?: string
  accessTokenExpiresAt?: string
  email?: string
}

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function credentialsKey() {
  const encoded = requiredEnvironment("STORAGE_CREDENTIALS_KEY")
  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32) throw new Error("STORAGE_CREDENTIALS_KEY must be a base64-encoded 32-byte key")
  return key
}

function stateKey() {
  return process.env.STORAGE_OAUTH_STATE_SECRET?.trim() || credentialsKey().toString("base64")
}

export function googleDriveConfigured() {
  const environmentPresent = Boolean(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID?.trim()
    && process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?.trim()
    && process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI?.trim()
    && process.env.STORAGE_CREDENTIALS_KEY?.trim()
    && process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PICKER_API_KEY?.trim(),
  )
  if (!environmentPresent) return false
  try {
    credentialsKey()
    return true
  } catch {
    return false
  }
}

export function googleDrivePickerConfigured() {
  return googleDriveConfigured()
}

export function getGoogleDriveConfig(): GoogleDriveConfig {
  return {
    clientId: requiredEnvironment("GOOGLE_DRIVE_OAUTH_CLIENT_ID"),
    clientSecret: requiredEnvironment("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"),
    redirectUri: requiredEnvironment("GOOGLE_DRIVE_OAUTH_REDIRECT_URI"),
    pickerApiKey: requiredEnvironment("NEXT_PUBLIC_GOOGLE_DRIVE_PICKER_API_KEY"),
  }
}

export function googleDriveConnectionId(workspaceId: string) {
  return `google-drive:${workspaceId}`
}

export function encryptGoogleDriveCredentials(credentials: GoogleDriveCredentials) {
  const key = credentialsKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`
}

export function decryptGoogleDriveCredentials(ciphertext: string): GoogleDriveCredentials {
  const [version, ivEncoded, tagEncoded, payloadEncoded] = ciphertext.split(".")
  if (version !== "v1" || !ivEncoded || !tagEncoded || !payloadEncoded) throw new Error("Stored Drive credentials are invalid")

  const decipher = createDecipheriv("aes-256-gcm", credentialsKey(), Buffer.from(ivEncoded, "base64url"))
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payloadEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8")
  const credentials = JSON.parse(plaintext) as GoogleDriveCredentials
  if (!credentials.refreshToken) throw new Error("Stored Drive credentials do not include a refresh token")
  return credentials
}

export function createGoogleDriveOAuthState(workspaceId: string, userId: string) {
  const payload = Buffer.from(JSON.stringify({ workspaceId, userId, expiresAt: Date.now() + 10 * 60 * 1000 })).toString("base64url")
  const signature = createHmac("sha256", stateKey()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyGoogleDriveOAuthState(state: string) {
  const [payload, signature] = state.split(".")
  if (!payload || !signature) return null
  const expected = createHmac("sha256", stateKey()).update(payload).digest("base64url")
  const suppliedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      workspaceId?: string
      userId?: string
      expiresAt?: number
    }
    if (!parsed.workspaceId || !parsed.userId || !parsed.expiresAt || parsed.expiresAt < Date.now()) return null
    return { workspaceId: parsed.workspaceId, userId: parsed.userId }
  } catch {
    return null
  }
}

export function googleDriveAuthorizationUrl(state: string) {
  const config = getGoogleDriveConfig()
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", GOOGLE_DRIVE_SCOPE)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", state)
  return url
}

async function tokenRequest(values: URLSearchParams) {
  const config = getGoogleDriveConfig()
  values.set("client_id", config.clientId)
  values.set("client_secret", config.clientSecret)
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: values,
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({})) as GoogleTokenResponse
  if (!response.ok || !result.access_token) throw new Error("Google Drive authorization could not be completed")
  return result
}

export async function exchangeGoogleDriveAuthorizationCode(code: string) {
  const result = await tokenRequest(new URLSearchParams({
    code,
    redirect_uri: getGoogleDriveConfig().redirectUri,
    grant_type: "authorization_code",
  }))
  if (!result.refresh_token) throw new Error("Google Drive did not return offline access. Try connecting again.")
  return {
    accessToken: result.access_token!,
    refreshToken: result.refresh_token,
    expiresAt: new Date(Date.now() + (result.expires_in ?? 3600) * 1000).toISOString(),
  }
}

async function refreshGoogleDriveAccessToken(refreshToken: string) {
  const result = await tokenRequest(new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }))
  return {
    accessToken: result.access_token!,
    expiresAt: new Date(Date.now() + (result.expires_in ?? 3600) * 1000).toISOString(),
  }
}

export async function getGoogleDriveUser(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Google Drive account could not be verified")
  const body = await response.json() as { user?: { displayName?: string; emailAddress?: string } }
  return body.user ?? {}
}

export async function getGoogleDriveAccessToken(workspaceId: string) {
  const connection = await db.query.storageConnections.findFirst({
    where: and(
      eq(storageConnections.workspaceId, workspaceId),
      eq(storageConnections.provider, "google_drive"),
    ),
  })
  if (!connection?.credentialsCiphertext) throw new Error("Google Drive is not connected")

  const credentials = decryptGoogleDriveCredentials(connection.credentialsCiphertext)
  const expiresAt = credentials.accessTokenExpiresAt ? new Date(credentials.accessTokenExpiresAt).getTime() : 0
  if (credentials.accessToken && expiresAt > Date.now() + 60_000) return credentials.accessToken

  const refreshed = await refreshGoogleDriveAccessToken(credentials.refreshToken)
  await db.update(storageConnections).set({
    credentialsCiphertext: encryptGoogleDriveCredentials({
      ...credentials,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.expiresAt,
    }),
    lastCheckedAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(storageConnections.id, connection.id))
  return refreshed.accessToken
}

export async function verifyGoogleDriveFolder(accessToken: string, folderId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  )
  if (!response.ok) throw new Error("Frameshare cannot access that Google Drive folder")
  const folder = await response.json() as {
    id?: string
    name?: string
    mimeType?: string
    trashed?: boolean
    capabilities?: { canAddChildren?: boolean }
  }
  if (folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed || !folder.capabilities?.canAddChildren) {
    throw new Error("Choose an active Google Drive folder that allows Frameshare to add files")
  }
  return { id: folder.id ?? folderId, name: folder.name ?? "Google Drive folder" }
}
