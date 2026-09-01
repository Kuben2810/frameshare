import type { InferSelectModel } from "drizzle-orm"
import { and, eq, inArray, lt } from "drizzle-orm"
import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { adjustStorageQuota } from "@/lib/db-guards"
import { deleteMediaObject, getGalleryStorageConnection } from "@/lib/media-storage"
import { s3Keys } from "@/lib/s3-keys"

type Photo = InferSelectModel<typeof photos>
type CleanableStatus = "pending" | "processing" | "error" | "cleaning"

const CLEANABLE_STATUSES: CleanableStatus[] = ["pending", "processing", "error", "cleaning"]

function uploadKeys(photo: Photo, provider: "managed" | "google_drive" | "s3"): string[] {
  const generated = s3Keys(photo.id)
  const generatedKeys = provider === "managed"
    ? [generated.thumb(), generated.display(), generated.watermarked()]
    : []
  return [...new Set([
    photo.originalKey,
    photo.thumbKey,
    photo.displayKey,
    photo.watermarkedKey,
    ...generatedKeys,
  ].filter((key): key is string => Boolean(key)))]
}

/**
 * Claim an incomplete upload, delete any source/derivative objects, and then
 * release its reservation. Claiming with `cleaning` prevents cleanup from
 * racing a retry that has moved the row to `processing`.
 */
export async function discardUploadPhoto(
  photoId: string,
  userId: string,
  statuses: CleanableStatus[] = CLEANABLE_STATUSES,
): Promise<boolean> {
  const [photo] = await db
    .update(photos)
    .set({ status: "cleaning" })
    .where(and(
      eq(photos.id, photoId),
      eq(photos.userId, userId),
      inArray(photos.status, statuses),
    ))
    .returning()
  if (!photo) return false

  const gallery = await db.query.galleries.findFirst({ where: eq(galleries.id, photo.galleryId) })
  if (!gallery) return false
  const storageConnection = await getGalleryStorageConnection(gallery.id)

  const deletions = await Promise.allSettled(uploadKeys(photo, storageConnection.provider).map((key) => deleteMediaObject(storageConnection, key)))
  if (deletions.some((result) => result.status === "rejected")) return false

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(photos)
      .where(and(eq(photos.id, photo.id), eq(photos.status, "cleaning")))
      .returning({ id: photos.id })
    if (deleted) await adjustStorageQuota(gallery.workspaceId, -photo.fileSizeBytes, tx)
  })
  return true
}

/** Best-effort reclamation run before a user's next upload reservation. */
export async function cleanupStaleUploadsForUser(userId: string, maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs)
  const stale = await db.query.photos.findMany({
    where: and(
      eq(photos.userId, userId),
      inArray(photos.status, CLEANABLE_STATUSES),
      lt(photos.createdAt, cutoff),
    ),
    columns: { id: true },
    limit: 50,
  })

  let cleaned = 0
  for (const photo of stale) {
    if (await discardUploadPhoto(photo.id, userId)) cleaned++
  }
  return cleaned
}
