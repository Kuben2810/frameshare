import { auth } from "@/auth"
import { db } from "@/db"
import { photos, users, galleries } from "@/db/schema"
import { eq } from "drizzle-orm"
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { s3, BUCKET } from "@/lib/s3"
import sharp from "sharp"

async function downloadFromS3(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks: Uint8Array[] = []
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function uploadToS3(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
}

function watermarkSvg(name: string, width: number, height: number): Buffer {
  const escaped = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const fontSize = Math.max(12, Math.round(width * 0.02))
  const padding = Math.round(fontSize * 0.8)
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${width - padding}" y="${height - padding}"
      font-family="Arial, sans-serif" font-size="${fontSize}"
      fill="white" fill-opacity="0.75"
      text-anchor="end" dominant-baseline="auto"
    >© ${escaped}</text>
  </svg>`
  return Buffer.from(svg)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { photoId } = await req.json()

  const photo = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
  if (!photo || photo.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  if (photo.status !== "pending") {
    return Response.json({ error: "Already processed" }, { status: 409 })
  }

  // Get photographer name for watermark
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  const photographerName = user?.name ?? "Frameshare"

  try {
    const original = await downloadFromS3(photo.originalKey)
    const base = photo.originalKey.replace(/\/original\.\w+$/, "")
    const meta = await sharp(original).metadata()
    const w = meta.width ?? 1200
    const h = meta.height ?? 800

    const [thumb, display, watermarked] = await Promise.all([
      // thumb: 400px WebP
      sharp(original)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      // display: 2048px WebP
      sharp(original)
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer(),
      // watermarked: 1200px JPEG with name overlay
      (async () => {
        const resized = await sharp(original)
          .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
          .toBuffer()
        const resizedMeta = await sharp(resized).metadata()
        const rw = resizedMeta.width ?? 1200
        const rh = resizedMeta.height ?? 800
        return sharp(resized)
          .composite([{ input: watermarkSvg(photographerName, rw, rh), blend: "over" }])
          .jpeg({ quality: 82 })
          .toBuffer()
      })(),
    ])

    const thumbKey       = `${base}/thumb.webp`
    const displayKey     = `${base}/display.webp`
    const watermarkedKey = `${base}/watermarked.jpg`

    await Promise.all([
      uploadToS3(thumbKey, thumb, "image/webp"),
      uploadToS3(displayKey, display, "image/webp"),
      uploadToS3(watermarkedKey, watermarked, "image/jpeg"),
    ])

    const [updated] = await db.update(photos)
      .set({ thumbKey, displayKey, watermarkedKey, width: w, height: h, status: "ready" })
      .where(eq(photos.id, photoId))
      .returning()

    return Response.json({ photo: updated })
  } catch (err) {
    await db.update(photos).set({ status: "error" }).where(eq(photos.id, photoId))
    console.error("Processing error", err)
    return Response.json({ error: "Processing failed" }, { status: 500 })
  }
}
