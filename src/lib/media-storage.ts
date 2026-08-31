import { GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import type { InferSelectModel } from "drizzle-orm"
import { db } from "@/db"
import { galleries, storageConnections } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import {
  getGoogleDriveAccessToken,
  googleDriveConnectionId,
} from "@/lib/google-drive"
import { BUCKET, deleteKey, downloadBuffer, getObjectSize, s3, uploadBuffer } from "@/lib/s3"

type StorageConnection = InferSelectModel<typeof storageConnections>

const DRIVE_KEY_PREFIX = "drive/"
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

export function driveMediaKey(fileId: string) {
  return `${DRIVE_KEY_PREFIX}${fileId}`
}

function driveFileIdFromKey(key: string) {
  if (!key.startsWith(DRIVE_KEY_PREFIX)) return null
  const fileId = key.slice(DRIVE_KEY_PREFIX.length)
  return fileId && !fileId.includes("/") ? fileId : null
}

function assertActiveConnection(connection: StorageConnection) {
  if (connection.status !== "active") throw new Error("This gallery's storage connection is unavailable")
  if (connection.provider === "google_drive" && !connection.rootReference) {
    throw new Error("This Google Drive connection has no selected folder")
  }
}

export async function getGalleryStorageConnection(galleryId: string) {
  const [result] = await db
    .select({ connection: storageConnections })
    .from(galleries)
    .innerJoin(storageConnections, eq(galleries.storageConnectionId, storageConnections.id))
    .where(eq(galleries.id, galleryId))
    .limit(1)
  if (!result) throw new Error("Gallery storage connection was not found")
  return result.connection
}

async function driveFetch(connection: StorageConnection, path: string, init: RequestInit = {}) {
  assertActiveConnection(connection)
  if (connection.provider !== "google_drive") throw new Error("Not a Google Drive connection")
  const accessToken = await getGoogleDriveAccessToken(connection.workspaceId)
  return fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })
}

async function driveUploadFetch(connection: StorageConnection, path: string, init: RequestInit = {}) {
  assertActiveConnection(connection)
  if (connection.provider !== "google_drive") throw new Error("Not a Google Drive connection")
  const accessToken = await getGoogleDriveAccessToken(connection.workspaceId)
  return fetch(`https://www.googleapis.com/upload/drive/v3/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })
}

export async function createGoogleDriveResumableUpload(
  connection: StorageConnection,
  filename: string,
  mimeType: string,
  bytes: number,
) {
  assertActiveConnection(connection)
  if (connection.provider !== "google_drive" || !connection.rootReference) throw new Error("Google Drive is not ready")
  const response = await driveUploadFetch(connection, "files?uploadType=resumable&supportsAllDrives=true&fields=id,size,mimeType", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(bytes),
    },
    body: JSON.stringify({
      name: filename,
      mimeType,
      parents: [connection.rootReference],
    }),
  })
  const uploadUrl = response.headers.get("location")
  if (!response.ok || !uploadUrl) throw new Error("Google Drive could not create an upload session")
  return uploadUrl
}

export async function getGoogleDriveFileInfo(connection: StorageConnection, key: string) {
  const fileId = driveFileIdFromKey(key)
  if (!fileId) throw new Error("Invalid Google Drive media reference")
  const response = await driveFetch(
    connection,
    `files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed,parents&supportsAllDrives=true`,
  )
  if (!response.ok) throw new Error("Google Drive file could not be verified")
  const file = await response.json() as {
    id?: string
    name?: string
    mimeType?: string
    size?: string
    trashed?: boolean
    parents?: string[]
  }
  const size = Number(file.size)
  if (!file.id || file.trashed || !Number.isSafeInteger(size) || size <= 0) throw new Error("Google Drive file is unavailable")
  if (!connection.rootReference || !file.parents?.includes(connection.rootReference)) {
    throw new Error("Google Drive file is outside this workspace folder")
  }
  return { id: file.id, name: file.name ?? "upload", mimeType: file.mimeType ?? "application/octet-stream", size }
}

export async function uploadMediaBuffer(
  connection: StorageConnection,
  filename: string,
  buffer: Buffer,
  mimeType: string,
) {
  assertActiveConnection(connection)
  if (connection.provider === "managed") {
    await uploadBuffer(filename, buffer, mimeType)
    return filename
  }
  if (connection.provider !== "google_drive" || !connection.rootReference) throw new Error("Unsupported storage provider")

  const sessionUrl = await createGoogleDriveResumableUpload(connection, filename, mimeType, buffer.length)
  const payload = new Uint8Array(buffer.length)
  payload.set(buffer)
  const response = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType, "Content-Length": String(buffer.length) },
    body: payload,
    cache: "no-store",
  })
  const file = await response.json().catch(() => ({})) as { id?: string }
  if (!response.ok || !file.id) throw new Error("Google Drive could not save generated media")
  return driveMediaKey(file.id)
}

export async function downloadMediaBuffer(connection: StorageConnection, key: string) {
  assertActiveConnection(connection)
  if (connection.provider === "managed") return downloadBuffer(key)
  const fileId = driveFileIdFromKey(key)
  if (!fileId) throw new Error("Invalid Google Drive media reference")
  const response = await driveFetch(connection, `files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)
  if (!response.ok) throw new Error("Google Drive media is unavailable")
  return Buffer.from(await response.arrayBuffer())
}

export async function getMediaObjectSize(connection: StorageConnection, key: string) {
  assertActiveConnection(connection)
  if (connection.provider === "managed") return getObjectSize(key)
  return (await getGoogleDriveFileInfo(connection, key)).size
}

export async function deleteMediaObject(connection: StorageConnection, key: string) {
  if (connection.provider === "managed") return deleteKey(key)
  const fileId = driveFileIdFromKey(key)
  if (!fileId) return
  const response = await driveFetch(connection, `files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: "DELETE" })
  if (!response.ok && response.status !== 404) throw new Error("Google Drive media could not be deleted")
}

export async function streamMediaObject(connection: StorageConnection, key: string) {
  assertActiveConnection(connection)
  if (connection.provider === "managed") {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    if (!response.Body) throw new Error("Media is unavailable")
    return { body: response.Body as unknown as ReadableStream<Uint8Array>, contentType: response.ContentType ?? "application/octet-stream" }
  }
  const fileId = driveFileIdFromKey(key)
  if (!fileId) throw new Error("Invalid Google Drive media reference")
  const response = await driveFetch(connection, `files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)
  if (!response.ok || !response.body) throw new Error("Google Drive media is unavailable")
  return { body: response.body, contentType: response.headers.get("content-type") ?? "application/octet-stream" }
}

export async function streamMediaNodeReadable(connection: StorageConnection, key: string) {
  if (connection.provider === "managed") {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    if (!response.Body) throw new Error("Media is unavailable")
    return response.Body as Readable
  }
  const object = await streamMediaObject(connection, key)
  return Readable.fromWeb(object.body as import("stream/web").ReadableStream)
}

export function isGoogleDriveConnection(connection: StorageConnection) {
  return connection.id === googleDriveConnectionId(connection.workspaceId) && connection.provider === "google_drive"
}

export function isFolderMimeType(mimeType: string) {
  return mimeType === DRIVE_FOLDER_MIME_TYPE
}
