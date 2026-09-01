import { auth } from "@/auth"
import { db } from "@/db"
import { photos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { s3, BUCKET } from "@/lib/s3"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getGalleryStorageConnection } from "@/lib/media-storage"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  const photoId = searchParams.get("photoId")
  if (!key || !photoId) return Response.json({ error: "Missing key or photoId" }, { status: 400 })

  // This endpoint must never act as a general-purpose S3 proxy. A pending
  // photo can only receive bytes at the object key generated for that photo.
  const photo = await db.query.photos.findFirst({
    where: and(
      eq(photos.id, photoId),
      eq(photos.userId, session.user.id),
      eq(photos.originalKey, key),
      eq(photos.status, "pending"),
    ),
  })
  if (!photo) return Response.json({ error: "Forbidden" }, { status: 403 })

  const storageConnection = await getGalleryStorageConnection(photo.galleryId)
  if (storageConnection.provider !== "managed") {
    return Response.json({ error: "Google Drive uploads must use the verified resumable session" }, { status: 409 })
  }

  const body = await req.arrayBuffer()
  const mimeType = req.headers.get("content-type") || "application/octet-stream"

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(body),
    ContentType: mimeType,
  }))

  return Response.json({ ok: true })
}
