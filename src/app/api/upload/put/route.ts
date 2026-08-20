import { auth } from "@/auth"
import { db } from "@/db"
import { photos } from "@/db/schema"
import { eq } from "drizzle-orm"
import { s3, BUCKET } from "@/lib/s3"
import { PutObjectCommand } from "@aws-sdk/client-s3"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get("key")
  const photoId = searchParams.get("photoId")
  if (!key || !photoId) return Response.json({ error: "Missing key or photoId" }, { status: 400 })

  const photo = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
  if (!photo || photo.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 })

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
