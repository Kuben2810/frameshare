import { db } from "@/db"
import { photos, users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { uploadBuffer, downloadBuffer, deleteKey } from "@/lib/s3"
import { s3Keys } from "@/lib/s3-keys"
import { getDecodableImageBuffer, extractRawOrientation } from "@/lib/raw-decoder"
import { adjustStorageQuota } from "@/lib/db-guards"
import sharp from "sharp"

function proofWatermarkSvg(name: string, width: number, height: number): Buffer {
  const escaped = (name || "Frameshare").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const fontSizeMain = Math.max(18, Math.round(Math.min(width, height) * 0.055))
  const fontSizeSub = Math.max(11, Math.round(fontSizeMain * 0.42))

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="proofShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
    </defs>
    <!-- Center Diagonal Main Proof Watermark -->
    <g transform="translate(${width / 2}, ${height / 2}) rotate(-28)" filter="url(#proofShadow)">
      <text
        x="0" y="-${fontSizeSub * 0.8}"
        font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${fontSizeMain}"
        letter-spacing="6"
        fill="white" fill-opacity="0.4"
        text-anchor="middle" dominant-baseline="central"
      >PROOF ONLY • NOT FINAL EDIT</text>
      <text
        x="0" y="${fontSizeMain * 0.75}"
        font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSizeSub}"
        letter-spacing="3"
        fill="white" fill-opacity="0.32"
        text-anchor="middle" dominant-baseline="central"
      >© ${escaped} • FOR CLIENT SELECTION ONLY</text>
    </g>

    <!-- Subtle bottom right studio copyright -->
    <text
      x="${width - 16}" y="${height - 16}"
      font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${Math.max(11, Math.round(width * 0.016))}"
      fill="white" fill-opacity="0.55" filter="url(#proofShadow)"
      text-anchor="end" dominant-baseline="auto"
    >© ${escaped} [PROOF PREVIEW]</text>
  </svg>`

  return Buffer.from(svg)
}

function studioWatermarkSvg(name: string, width: number, height: number): Buffer {
  const escaped = (name || "Frameshare").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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

  const rawOriginal = await downloadBuffer(photo.originalKey)
  // Convert or extract decodable image buffer for RAW (CR2, NEF, ARW, DNG) or standard images
  const original = await getDecodableImageBuffer(rawOriginal, photo.filename)

  const keys = s3Keys(photoId)
  const rawOrientation = extractRawOrientation(rawOriginal) ?? extractRawOrientation(original)
  const meta = await sharp(original).metadata()

  const effectiveOrientation = rawOrientation ?? meta.orientation ?? 1
  let rotateAngle: number | undefined
  if (effectiveOrientation === 3) rotateAngle = 180
  else if (effectiveOrientation === 6) rotateAngle = 90
  else if (effectiveOrientation === 8) rotateAngle = 270

  const isRotated = rotateAngle === 90 || rotateAngle === 270 || (meta.orientation && meta.orientation >= 5 && meta.orientation <= 8)
  const origW = meta.width ?? 1200
  const origH = meta.height ?? 800
  const w = isRotated ? origH : origW
  const h = isRotated ? origW : origH

  const isProofing = (photo.section ?? "proofing") === "proofing"

  // Rotator helper: rotates explicitly if RAW IFD orientation exists, or uses Sharp auto-rotate
  const rotateBuffer = (buf: Buffer) => (rotateAngle !== undefined ? sharp(buf).rotate(rotateAngle) : sharp(buf).rotate())

  const [thumb, display, watermarked] = await Promise.all([
    // Ultra-crisp grid thumbnail: 1200px Lanczos3 with studio unsharp masking
    rotateBuffer(original)
      .resize(1200, 1200, {
        fit: "inside",
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.75, m1: 0.5, m2: 1.5 })
      .webp({ quality: 90, effort: 4 })
      .toBuffer(),

    // Display image: 2.5K QHD (2560px) master web display
    (async () => {
      const resized = await rotateBuffer(original)
        .resize(2560, 2560, {
          fit: "inside",
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 0.6, m1: 0.4, m2: 1.2 })
        .toBuffer()

      if (isProofing) {
        const rMeta = await sharp(resized).metadata()
        const rw = rMeta.width ?? 1200
        const rh = rMeta.height ?? 800
        return sharp(resized)
          .composite([{ input: proofWatermarkSvg(photographerName, rw, rh), blend: "over" }])
          .webp({ quality: 88, effort: 4 })
          .toBuffer()
      }

      return sharp(resized).webp({ quality: 92, effort: 4 }).toBuffer()
    })(),

    // Watermarked variant: 1600px
    (async () => {
      const resized = await rotateBuffer(original)
        .resize(1600, 1600, {
          fit: "inside",
          withoutEnlargement: true,
          kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 0.6, m1: 0.4, m2: 1.2 })
        .toBuffer()
      const resizedMeta = await sharp(resized).metadata()
      const rw = resizedMeta.width ?? 1200
      const rh = resizedMeta.height ?? 800
      const wmSvg = isProofing
        ? proofWatermarkSvg(photographerName, rw, rh)
        : studioWatermarkSvg(photographerName, rw, rh)

      return sharp(resized)
        .composite([{ input: wmSvg, blend: "over" }])
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer()
    })(),
  ])

  const thumbKey       = keys.thumb()
  const displayKey     = keys.display()
  const watermarkedKey = keys.watermarked()

  await Promise.all([
    uploadBuffer(thumbKey, thumb, "image/webp"),
    uploadBuffer(displayKey, display, "image/webp"),
    uploadBuffer(watermarkedKey, watermarked, "image/jpeg"),
  ])

  let finalOriginalKey = photo.originalKey
  let finalFileSizeBytes = photo.fileSizeBytes

  // For proofing photos, delete the heavy original raw file from S3 to conserve storage space.
  // The raw files remain stored in Lightroom on the photographer's local workstation.
  if (isProofing) {
    try {
      if (photo.originalKey && photo.originalKey !== displayKey) {
        await deleteKey(photo.originalKey)
      }
      finalOriginalKey = displayKey
      const totalWebBytes = thumb.length + display.length + watermarked.length
      const diffBytes = photo.fileSizeBytes - totalWebBytes
      if (diffBytes > 0) {
        await adjustStorageQuota(photo.userId, -diffBytes)
      }
      finalFileSizeBytes = totalWebBytes
    } catch (cleanupErr) {
      console.warn("Proofing storage optimization notice:", cleanupErr)
    }
  }

  await db.update(photos)
    .set({
      originalKey: finalOriginalKey,
      thumbKey,
      displayKey,
      watermarkedKey,
      width: w,
      height: h,
      fileSizeBytes: finalFileSizeBytes,
      status: "ready",
    })
    .where(eq(photos.id, photoId))
}
