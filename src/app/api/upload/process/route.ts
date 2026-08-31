import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos, workspaces } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { processPhoto } from "@/lib/process-photo"
import { MAX_SIZE_BYTES } from "@/lib/photo-constraints"
import { getObjectSize } from "@/lib/s3"
import { reconcileStorageReservation } from "@/lib/db-guards"
import { discardUploadPhoto } from "@/lib/upload-cleanup"
import { managedStorageConnectionId } from "@/lib/storage-connection"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { photoId } = await req.json()
  if (typeof photoId !== "string") return Response.json({ error: "photoId required" }, { status: 400 })

  // Claim the upload before inspecting or processing it so concurrent retries
  // cannot process the same object twice. Error records are intentionally
  // retryable until stale cleanup reclaims them.
  const [photo] = await db
    .update(photos)
    .set({ status: "processing" })
    .where(and(
      eq(photos.id, photoId),
      eq(photos.userId, session.user.id),
      inArray(photos.status, ["pending", "error"]),
    ))
    .returning()
  if (!photo) return Response.json({ error: "Already processing or processed" }, { status: 409 })

  const [gallery] = await db
    .select({ workspaceId: galleries.workspaceId, storageQuotaBytes: workspaces.storageQuotaBytes, storageConnectionId: galleries.storageConnectionId })
    .from(galleries)
    .innerJoin(workspaces, eq(galleries.workspaceId, workspaces.id))
    .where(eq(galleries.id, photo.galleryId))
    .limit(1)
  if (!gallery) {
    await discardUploadPhoto(photo.id, photo.userId, ["processing"])
    return Response.json({ error: "Gallery not found" }, { status: 404 })
  }
  if (gallery.storageConnectionId !== managedStorageConnectionId(gallery.workspaceId)) {
    await discardUploadPhoto(photo.id, photo.userId, ["processing"])
    return Response.json({ error: "This gallery's storage connection is not ready for processing" }, { status: 409 })
  }

  let actualSize: number
  try {
    actualSize = await getObjectSize(photo.originalKey)
  } catch {
    await discardUploadPhoto(photo.id, photo.userId, ["processing"])
    return Response.json({ error: "Uploaded file was not found" }, { status: 400 })
  }

  if (actualSize > MAX_SIZE_BYTES) {
    await discardUploadPhoto(photo.id, photo.userId, ["processing"])
    return Response.json({ error: "Uploaded file exceeds the 100 MB limit" }, { status: 413 })
  }

  const reconciled = await db.transaction(async (tx) => {
    const hasCapacity = await reconcileStorageReservation(
      gallery.workspaceId,
      photo.fileSizeBytes,
      actualSize,
      gallery.storageQuotaBytes,
      tx,
    )
    if (!hasCapacity) return false
    await tx.update(photos)
      .set({ fileSizeBytes: actualSize })
      .where(and(eq(photos.id, photo.id), eq(photos.status, "processing")))
    return true
  })
  if (!reconciled) {
    await discardUploadPhoto(photo.id, photo.userId, ["processing"])
    return Response.json({ error: "Uploaded file exceeds your storage quota" }, { status: 413 })
  }

  try {
    await processPhoto(photoId)
    const updated = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
    return Response.json({ photo: updated })
  } catch (err: unknown) {
    await db.update(photos)
      .set({ status: "error" })
      .where(and(eq(photos.id, photoId), eq(photos.status, "processing")))
    console.error("Processing error", err)
    const reason = err instanceof Error ? err.message : "Transcoding failed: Unsupported image compression or damaged file"
    return Response.json({ error: reason }, { status: 500 })
  }
}
