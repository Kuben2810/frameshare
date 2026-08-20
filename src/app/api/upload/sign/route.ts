import { auth } from "@/auth"
import { db } from "@/db"
import { photos, users, galleries } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { validatePhoto } from "@/lib/photo-constraints"
import { s3Keys } from "@/lib/s3-keys"
import { adjustStorageQuota } from "@/lib/db-guards"

const STORAGE_LIMIT = Number(process.env.STORAGE_LIMIT_BYTES) || 10_737_418_240

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { galleryId, filename, fileSize, mimeType, section } = await req.json()

  const v = validatePhoto({ name: filename, type: mimeType, size: fileSize })
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 })

  // Verify gallery ownership
  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, galleryId), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) return Response.json({ error: "Gallery not found" }, { status: 404 })

  // Check quota
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })
  if (user.storageUsedBytes + fileSize > STORAGE_LIMIT) {
    const usedMB = (user.storageUsedBytes / (1024 * 1024)).toFixed(1)
    const limitGB = (STORAGE_LIMIT / (1024 * 1024 * 1024)).toFixed(0)
    return Response.json({
      error: `Storage quota exceeded: Used ${usedMB} MB of ${limitGB} GB limit. Upgrade storage or delete unused photos.`,
    }, { status: 413 })
  }

  const photoId = crypto.randomUUID()
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg"
  const originalKey = s3Keys(photoId).original(ext)

  const photoSection = section === "final" ? "final" : "proofing"

  // Reserve quota and insert pending photo atomically
  await db.transaction(async (tx) => {
    await adjustStorageQuota(session.user!.id!, fileSize, tx)
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
  })

  const url = `/api/upload/put?key=${encodeURIComponent(originalKey)}&photoId=${photoId}`

  return Response.json({ url, photoId })
}
