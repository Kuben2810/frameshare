import { auth } from "@/auth"
import { db } from "@/db"
import { photos, users, galleries } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { s3, BUCKET } from "@/lib/s3"
import { sql } from "drizzle-orm"

const STORAGE_LIMIT = Number(process.env.STORAGE_LIMIT_BYTES ?? 10_737_418_240)
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/tiff", "image/webp"])

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { galleryId, filename, fileSize, mimeType } = await req.json()

  if (!ALLOWED_TYPES.has(mimeType)) return Response.json({ error: "Invalid file type" }, { status: 400 })
  if (!fileSize || fileSize > 50 * 1024 * 1024) return Response.json({ error: "File too large" }, { status: 400 })

  // Verify gallery ownership
  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, galleryId), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) return Response.json({ error: "Gallery not found" }, { status: 404 })

  // Check quota
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })
  if (user.storageUsedBytes + fileSize > STORAGE_LIMIT) {
    return Response.json({ error: "Storage quota exceeded" }, { status: 413 })
  }

  const photoId = crypto.randomUUID()
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg"
  const originalKey = `photos/${photoId}/original.${ext}`

  // Reserve quota and insert pending photo atomically
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`UPDATE users SET storage_used_bytes = storage_used_bytes + ${fileSize} WHERE id = ${session.user!.id}`
    )
    await tx.insert(photos).values({
      id: photoId,
      galleryId,
      userId: session.user!.id!,
      originalKey,
      filename,
      mimeType,
      fileSizeBytes: fileSize,
      status: "pending",
    })
  })

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: originalKey, ContentType: mimeType }),
    { expiresIn: 900 }
  )

  return Response.json({ url, photoId })
}
