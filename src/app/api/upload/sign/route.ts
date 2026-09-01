import { auth } from "@/auth"
import { db } from "@/db"
import { photos } from "@/db/schema"
import { validatePhoto } from "@/lib/photo-constraints"
import { s3Keys } from "@/lib/s3-keys"
import { reserveStorageQuota } from "@/lib/db-guards"
import { presignUpload } from "@/lib/s3"
import { cleanupStaleUploadsForUser, discardUploadPhoto } from "@/lib/upload-cleanup"
import { requireGalleryWorkspaceAccess } from "@/lib/workspace"
import { createGoogleDriveResumableUpload, getGalleryStorageConnection } from "@/lib/media-storage"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { galleryId, filename, fileSize, mimeType, section } = await req.json()

  const v = validatePhoto({ name: filename, type: mimeType, size: fileSize })
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 })

  // Verify gallery ownership
  const access = await requireGalleryWorkspaceAccess(galleryId, session.user.id)
  if (!access) return Response.json({ error: "Gallery not found" }, { status: 404 })
  const { gallery, workspace } = access
  let storageConnection
  try {
    storageConnection = await getGalleryStorageConnection(gallery.id)
  } catch {
    return Response.json({ error: "This gallery's storage connection is not ready for uploads" }, { status: 409 })
  }

  // Reclaim abandoned reservations before making a new one. Errors remain
  // retryable for 24 hours before this best-effort cleanup runs.
  await cleanupStaleUploadsForUser(session.user.id, 24 * 60 * 60 * 1000)

  const photoId = crypto.randomUUID()
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg"
  const originalKey = storageConnection.provider === "managed"
    ? s3Keys(photoId).original(ext)
    : `drive/pending/${photoId}`

  const photoSection = section === "final" ? "final" : "proofing"

  // Reserve quota and insert pending photo atomically. The reservation is a
  // conditional database update, so concurrent sign requests cannot exceed it.
  const reserved = await db.transaction(async (tx) => {
    const hasCapacity = await reserveStorageQuota(gallery.workspaceId, fileSize, workspace.storageQuotaBytes, tx)
    if (!hasCapacity) return false
    await tx.insert(photos).values({
      id: photoId,
      galleryId,
      userId: session.user!.id!,
      section: photoSection,
      originalKey,
      filename,
      mimeType,
      fileSizeBytes: fileSize,
      status: "pending",
    })
    return true
  })
  if (!reserved) {
    return Response.json({ error: "Storage quota exceeded. Delete unused photos or upgrade storage." }, { status: 413 })
  }

  try {
    if (storageConnection.provider === "managed") {
      const url = await presignUpload(originalKey, mimeType)
      return Response.json({ url, photoId, uploadProtocol: "s3" })
    }
    if (storageConnection.provider === "google_drive") {
      const safeFilename = filename.replace(/[\\/\r\n]/g, "_")
      // The browser completes Drive's resumable session directly so files
      // never pass through a Vercel Function. The session URL is
      // self-authenticating via its upload_id; no browser-side bearer token
      // is needed and sending one causes a CORS preflight that Drive rejects.
      const url = await createGoogleDriveResumableUpload(
        storageConnection,
        `${photoId}-${safeFilename}`,
        mimeType,
        fileSize,
      )
      return Response.json({ url, photoId, uploadProtocol: "google-drive-resumable" }, {
        headers: { "Cache-Control": "no-store" },
      })
    }
  } catch {
    await discardUploadPhoto(photoId, session.user.id, ["pending"])
    return Response.json({ error: "Storage could not start this upload. Reconnect the storage provider and try again." }, { status: 409 })
  }

  return Response.json({ error: "This storage provider is not supported for uploads" }, { status: 409 })
}
