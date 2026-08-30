import { db } from "@/db"
import { galleries, photos, stars } from "@/db/schema"
import { eq, and, asc, inArray, or } from "drizzle-orm"
import { cookies } from "next/headers"
import { auth } from "@/auth"
// @ts-expect-error archiver uses export = format
import archiver from "archiver"
import { PassThrough, Readable } from "stream"
import { s3, BUCKET } from "@/lib/s3"
import { GetObjectCommand } from "@aws-sdk/client-s3"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "all"
  const section = searchParams.get("section") as "proofing" | "final" | null
  const clientId = searchParams.get("clientId")
  const photoId = searchParams.get("photoId")

  const decodedSlug = decodeURIComponent(slug).trim()
  const gallery = await db.query.galleries.findFirst({
    where: or(eq(galleries.slug, decodedSlug), eq(galleries.id, decodedSlug)),
  })
  if (!gallery) return new Response("Gallery not found", { status: 404 })

  const session = await auth()
  const isOwner = !!(session?.user?.id && session.user.id === gallery.userId)

  // Check expiry
  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date() && !isOwner) {
    return new Response("Gallery has expired", { status: 403 })
  }

  // Check password
  if (gallery.passwordHash && !isOwner) {
    const cookieStore = await cookies()
    const isUnlocked = cookieStore.get(`gallery_unlocked_${gallery.id}`)?.value === "1"
    if (!isUnlocked) return new Response("Gallery is locked", { status: 401 })
  }

  // Check download permission
  if (gallery.downloadMode === "none" && !isOwner) {
    return new Response("Downloads are disabled for this gallery", { status: 403 })
  }

  let selectedPhotoIds: string[] | null = null
  if (photoId) {
    selectedPhotoIds = [photoId]
  } else if (type === "starred" && clientId) {
    const starredRows = await db.query.stars.findMany({
      where: and(eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId)),
    })
    selectedPhotoIds = starredRows.map((s) => s.photoId)
    if (selectedPhotoIds.length === 0) {
      return new Response("No starred photos found to download", { status: 400 })
    }
  }

  const galleryPhotos = await db.query.photos.findMany({
    where: and(
      eq(photos.galleryId, gallery.id),
      eq(photos.status, "ready"),
      section ? eq(photos.section, section) : undefined,
      selectedPhotoIds ? inArray(photos.id, selectedPhotoIds) : undefined
    ),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
  })

  if (galleryPhotos.length === 0) {
    return new Response("No photos available to download", { status: 404 })
  }

  const isFullDownload = isOwner || gallery.downloadMode === "full"

  if (photoId) {
    const photo = galleryPhotos[0]
    const key = isFullDownload ? photo.originalKey : photo.watermarkedKey
    if (!key) return new Response("Download unavailable", { status: 404 })

    try {
      const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
      if (!s3Res.Body) return new Response("Download unavailable", { status: 404 })

      const filename = photo.filename.replace(/[\\"\r\n]/g, "_")
      return new Response(s3Res.Body as ReadableStream, {
        headers: {
          "Content-Type": s3Res.ContentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache",
        },
      })
    } catch {
      return new Response("Download unavailable", { status: 404 })
    }
  }

  const archive = archiver("zip", { zlib: { level: 5 } })
  const passThrough = new PassThrough()

  archive.pipe(passThrough)

  // Process and append each photo asynchronously to the stream
  ;(async () => {
    try {
      const filenameCounts = new Map<string, number>()

      for (const photo of galleryPhotos) {
        const key = isFullDownload
          ? photo.originalKey
          : (photo.watermarkedKey || photo.displayKey)
        if (!key) continue

        let name = photo.filename || `photo-${photo.id}.jpg`
        const count = filenameCounts.get(name) || 0
        filenameCounts.set(name, count + 1)
        if (count > 0) {
          const parts = name.split(".")
          const ext = parts.length > 1 ? `.${parts.pop()}` : ""
          name = `${parts.join(".")}_${count}${ext}`
        }

        try {
          const s3Res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
          if (s3Res.Body) {
            archive.append(s3Res.Body as Readable, { name })
          }
        } catch (err) {
          console.error(`Failed to stream photo ${photo.id} to zip:`, err)
        }
      }
      await archive.finalize()
    } catch (err) {
      console.error("Archive generation error:", err)
      archive.abort()
    }
  })()

  const safeTitle = (gallery.name || "gallery").replace(/[^a-zA-Z0-9_-]/g, "_")
  const sectionTag = section === "final" ? "-master-edits" : section === "proofing" ? "-proofing-set" : ""
  const zipFilename = type === "starred" ? `${safeTitle}-favorites.zip` : `${safeTitle}${sectionTag}.zip`

  // Convert Node stream to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      passThrough.on("data", (chunk) => controller.enqueue(chunk))
      passThrough.on("end", () => controller.close())
      passThrough.on("error", (err) => controller.error(err))
    },
    cancel() {
      passThrough.destroy()
    },
  })

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Cache-Control": "no-cache",
    },
  })
}
