import { auth } from "@/auth"
import { db } from "@/db"
import { photos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { discardUploadPhoto } from "@/lib/upload-cleanup"
import { createGoogleDriveResumableUpload, getGalleryStorageConnection } from "@/lib/media-storage"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const photoId = formData.get("photoId")
  const file = formData.get("file")
  if (typeof photoId !== "string" || !(file instanceof File)) {
    return Response.json({ error: "photoId and file required" }, { status: 400 })
  }

  // Verify the photo belongs to this user and is still pending
  const photo = await db.query.photos.findFirst({
    where: and(
      eq(photos.id, photoId),
      eq(photos.userId, session.user.id),
      eq(photos.status, "pending"),
    ),
    columns: { id: true, galleryId: true, filename: true, mimeType: true, fileSizeBytes: true },
  })
  if (!photo) return Response.json({ error: "Upload record not found or already processed" }, { status: 404 })

  if (file.size !== photo.fileSizeBytes) {
    return Response.json({ error: "File size does not match reservation" }, { status: 400 })
  }

  let storageConnection
  try {
    storageConnection = await getGalleryStorageConnection(photo.galleryId)
  } catch {
    return Response.json({ error: "Storage connection unavailable" }, { status: 409 })
  }
  if (storageConnection.provider !== "google_drive") {
    return Response.json({ error: "Gallery is not using Drive storage" }, { status: 409 })
  }

  try {
    const safeFilename = photo.filename.replace(/[\\/\r\n]/g, "_")
    const sessionUrl = await createGoogleDriveResumableUpload(
      storageConnection,
      `${photoId}-${safeFilename}`,
      photo.mimeType,
      file.size,
    )
    const buffer = await file.arrayBuffer()
    const uploadResponse = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(file.size),
      },
      body: buffer,
    })
    const result = await uploadResponse.json().catch(() => ({})) as { id?: string }
    if (!uploadResponse.ok || !result.id) {
      await discardUploadPhoto(photoId, session.user.id, ["pending"])
      return Response.json({ error: "Google Drive upload failed" }, { status: 502 })
    }
    return Response.json({ driveFileId: result.id })
  } catch {
    await discardUploadPhoto(photoId, session.user.id, ["pending"])
    return Response.json({ error: "Drive upload failed. Reconnect storage and try again." }, { status: 502 })
  }
}
