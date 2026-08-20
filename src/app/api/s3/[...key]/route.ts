import { GetObjectCommand } from "@aws-sdk/client-s3"
import { s3, BUCKET } from "@/lib/s3"
import { db } from "@/db"
import { photos, galleries } from "@/db/schema"
import { eq, or } from "drizzle-orm"
import { auth } from "@/auth"
import { cookies } from "next/headers"

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params
  if (!key || key.length === 0) {
    return new Response("Not found", { status: 404 })
  }

  const s3Key = key.join("/")

  // If the key is a logo (logos/...), allow it
  if (key[0] === "logos") {
    return serveS3Object(s3Key, "public, max-age=31536000, immutable")
  }

  // If the key is a photo (photos/<photoId>/...)
  if (key[0] === "photos") {
    const photoId = key[1]
    let photo = photoId
      ? await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
      : null

    if (!photo) {
      photo = await db.query.photos.findFirst({
        where: or(
          eq(photos.originalKey, s3Key),
          eq(photos.thumbKey, s3Key),
          eq(photos.displayKey, s3Key),
          eq(photos.watermarkedKey, s3Key)
        ),
      })
    }

    if (!photo) {
      return new Response("Not found", { status: 404 })
    }

    const gallery = await db.query.galleries.findFirst({
      where: eq(galleries.id, photo.galleryId),
    })

    if (!gallery) {
      return new Response("Not found", { status: 404 })
    }

    const session = await auth()
    const isOwner = !!(session?.user?.id && session.user.id === gallery.userId)

    // Check expiry
    const isExpired = gallery.expiresAt && new Date(gallery.expiresAt) < new Date()
    if (isExpired && !isOwner) {
      return new Response("Forbidden", { status: 403 })
    }

    // Check password protection
    if (gallery.passwordHash && !isOwner) {
      const cookieStore = await cookies()
      const isUnlocked = cookieStore.get(`gallery_unlocked_${gallery.id}`)?.value === "1"
      if (!isUnlocked) {
        return new Response("Forbidden", { status: 403 })
      }
    }

    const isPublic = !gallery.passwordHash && !isExpired
    const cacheControl = isPublic
      ? "public, max-age=86400, stale-while-revalidate=604800"
      : "private, max-age=3600"
    return serveS3Object(s3Key, cacheControl)
  }

  return new Response("Not found", { status: 404 })
}

async function serveS3Object(s3Key: string, cacheControl: string) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    const body = res.Body as ReadableStream
    return new Response(body, {
      headers: {
        "Content-Type": res.ContentType ?? "application/octet-stream",
        "Cache-Control": cacheControl,
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
