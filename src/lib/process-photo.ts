import { db } from "@/db"
import { photos, users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { uploadBuffer, downloadBuffer } from "@/lib/s3"
import sharp from "sharp"

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

export async function processPhoto(photoId: string): Promise<void> {
  const photo = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
  if (!photo) throw new Error(`Photo ${photoId} not found`)

  const user = await db.query.users.findFirst({ where: eq(users.id, photo.userId) })
  const photographerName = user?.name ?? "Frameshare"

  const original = await downloadBuffer(photo.originalKey)
  const base = photo.originalKey.replace(/\/original\.\w+$/, "")
  const meta = await sharp(original).metadata()
  const w = meta.width ?? 1200
  const h = meta.height ?? 800

  const [thumb, display, watermarked] = await Promise.all([
    sharp(original)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(original)
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
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
    uploadBuffer(thumbKey, thumb, "image/webp"),
    uploadBuffer(displayKey, display, "image/webp"),
    uploadBuffer(watermarkedKey, watermarked, "image/jpeg"),
  ])

  await db.update(photos)
    .set({ thumbKey, displayKey, watermarkedKey, width: w, height: h, status: "ready" })
    .where(eq(photos.id, photoId))
}
