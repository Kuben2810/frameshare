"use server"

import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { requireAuth } from "@/lib/require-auth"
import { deleteKey, downloadBuffer, uploadBuffer } from "@/lib/s3"
import { adjustStorageQuota } from "@/lib/db-guards"
import { ensureColumnsMigrated } from "@/db/auto-migrate"
import sharp from "sharp"

function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

export async function createGallery(formData: FormData) {
  const userId = await requireAuth()
  await ensureColumnsMigrated()

  const name = (formData.get("name") as string)?.trim()
  if (!name) return { error: "Name required" }

  const rawPassword = formData.get("password") as string | null
  const passwordHash = rawPassword && rawPassword.trim() !== "" ? await bcrypt.hash(rawPassword.trim(), 10) : null

  const expiresAtRaw = formData.get("expiresAt") as string | null
  const expiresAt = expiresAtRaw && expiresAtRaw.trim() !== "" ? new Date(expiresAtRaw) : null

  const maxSelectionsRaw = formData.get("maxSelections") as string | null
  const maxSelections = maxSelectionsRaw && !isNaN(Number(maxSelectionsRaw)) && Number(maxSelectionsRaw) > 0 ? Number(maxSelectionsRaw) : null

  const stage = (formData.get("stage") as "proofing" | "delivered" | "both") ?? "proofing"

  const id = crypto.randomUUID()
  await db.insert(galleries).values({
    id,
    userId,
    name,
    slug: randomSlug(),
    passwordHash,
    expiresAt,
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full") ?? "none",
    stage,
    maxSelections,
  })

  redirect(`/dashboard/galleries/${id}`)
}

export async function updateGallery(id: string, formData: FormData) {
  const userId = await requireAuth()

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, userId)),
  })
  if (!gallery) return { error: "Not found" }

  const rawPassword = formData.get("password") as string | null
  const passwordHash =
    rawPassword && rawPassword.trim() !== ""
      ? await bcrypt.hash(rawPassword.trim(), 10)
      : rawPassword === ""
      ? null
      : undefined

  const expiresAtRaw = formData.get("expiresAt") as string | null
  const expiresAt = expiresAtRaw && expiresAtRaw.trim() !== "" ? new Date(expiresAtRaw) : null

  const maxSelectionsRaw = formData.get("maxSelections") as string | null
  const maxSelections = maxSelectionsRaw && !isNaN(Number(maxSelectionsRaw)) && Number(maxSelectionsRaw) > 0 ? Number(maxSelectionsRaw) : null

  const stageRaw = formData.get("stage") as "proofing" | "delivered" | "both" | null
  const stage = stageRaw ?? gallery.stage

  await db.update(galleries).set({
    name: (formData.get("name") as string).trim(),
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full"),
    expiresAt,
    stage,
    maxSelections,
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  }).where(eq(galleries.id, id))

  revalidatePath(`/dashboard/galleries/${id}`)
  revalidatePath(`/g/${gallery.slug}`)
}

export async function updateGalleryStage(id: string, stage: "proofing" | "delivered" | "both") {
  const userId = await requireAuth()

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, userId)),
  })
  if (!gallery) return { error: "Not found" }

  await db.update(galleries).set({ stage }).where(eq(galleries.id, id))
  revalidatePath(`/dashboard/galleries/${id}`)
  revalidatePath(`/g/${gallery.slug}`)
  return { success: true }
}

export async function movePhotosToSection(galleryId: string, photoIds: string[], targetSection: "proofing" | "final") {
  const userId = await requireAuth()

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, galleryId), eq(galleries.userId, userId)),
  })
  if (!gallery) return { error: "Not found" }

  if (photoIds.length === 0) return { success: true }

  for (const pid of photoIds) {
    await db.update(photos).set({ section: targetSection }).where(and(eq(photos.id, pid), eq(photos.galleryId, galleryId), eq(photos.userId, userId)))
  }

  revalidatePath(`/dashboard/galleries/${galleryId}`)
  revalidatePath(`/g/${gallery.slug}`)
  return { success: true }
}

export async function deleteGallery(id: string) {
  const userId = await requireAuth()

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, userId)),
  })
  if (!gallery) return { error: "Not found" }

  // Fetch all photos belonging to this gallery
  const galleryPhotos = await db.query.photos.findMany({
    where: eq(photos.galleryId, id),
  })

  // Compute total fileSizeBytes across all photos in the gallery
  const totalBytes = galleryPhotos.reduce((sum, p) => sum + (p.fileSizeBytes || 0), 0)

  // Gather S3 keys to delete
  const keysToDelete: string[] = []
  if (gallery.logoKey) {
    keysToDelete.push(gallery.logoKey)
  }
  for (const p of galleryPhotos) {
    if (p.originalKey) keysToDelete.push(p.originalKey)
    if (p.thumbKey) keysToDelete.push(p.thumbKey)
    if (p.displayKey) keysToDelete.push(p.displayKey)
    if (p.watermarkedKey) keysToDelete.push(p.watermarkedKey)
  }

  // Delete all S3 keys using deleteKey from @/lib/s3 (with error catching)
  await Promise.allSettled(
    keysToDelete.map(async (key) => {
      try {
        await deleteKey(key)
      } catch (err) {
        console.error(`Failed to delete S3 key ${key}:`, err)
      }
    })
  )

  // Delete gallery from database (cascading deletes for photos, stars, comments, selections)
  await db.delete(galleries).where(
    and(eq(galleries.id, id), eq(galleries.userId, userId))
  )

  // Decrement user storage
  if (totalBytes > 0) {
    await adjustStorageQuota(userId, -totalBytes)
  }

  redirect("/dashboard")
}

export async function updatePhotoOrder(galleryId: string, orderedIds: string[]) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, galleryId), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) return { error: "Not found" }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(photos)
        .set({ sortOrder: i })
        .where(and(eq(photos.id, orderedIds[i]), eq(photos.galleryId, galleryId)))
    }
  })

  revalidatePath(`/dashboard/galleries/${galleryId}`)
}

export async function deletePhoto(photoId: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const photo = await db.query.photos.findFirst({
    where: and(eq(photos.id, photoId), eq(photos.userId, session.user.id)),
  })
  if (!photo) return { error: "Not found" }

  const keysToDelete = [
    photo.originalKey,
    photo.thumbKey,
    photo.displayKey,
    photo.watermarkedKey,
  ].filter((k): k is string => Boolean(k))

  // Delete photo from database
  await db.delete(photos).where(eq(photos.id, photoId))

  // Delete all S3 keys using deleteKey from @/lib/s3 (with error catching)
  await Promise.allSettled(
    keysToDelete.map(async (key) => {
      try {
        await deleteKey(key)
      } catch (err) {
        console.error(`Failed to delete S3 key ${key}:`, err)
      }
    })
  )

  // Decrement user storage
  await adjustStorageQuota(session.user.id, -photo.fileSizeBytes)

  revalidatePath(`/dashboard/galleries/${photo.galleryId}`)
}

export async function unlockGallery(galleryId: string, password: string) {
  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, galleryId),
  })
  if (!gallery || !gallery.passwordHash) {
    return { success: false, error: "Gallery not found" }
  }

  const valid = await bcrypt.compare(password, gallery.passwordHash)
  if (!valid) {
    return { success: false, error: "Incorrect password" }
  }

  const cookieStore = await cookies()
  cookieStore.set(`gallery_unlocked_${gallery.id}`, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return { success: true }
}

export async function rotatePhoto(photoId: string, angle: 90 | 180 | 270 = 90) {
  const userId = await requireAuth()

  const photo = await db.query.photos.findFirst({
    where: and(eq(photos.id, photoId), eq(photos.userId, userId)),
  })
  if (!photo) return { error: "Photo not found" }

  const [thumbBuf, displayBuf, wmBuf] = await Promise.all([
    photo.thumbKey ? downloadBuffer(photo.thumbKey) : null,
    photo.displayKey ? downloadBuffer(photo.displayKey) : null,
    photo.watermarkedKey ? downloadBuffer(photo.watermarkedKey) : null,
  ])

  const [newThumb, newDisplay, newWm] = await Promise.all([
    thumbBuf ? sharp(thumbBuf).rotate(angle).webp({ quality: 80 }).toBuffer() : null,
    displayBuf ? sharp(displayBuf).rotate(angle).webp({ quality: 85 }).toBuffer() : null,
    wmBuf ? sharp(wmBuf).rotate(angle).jpeg({ quality: 82 }).toBuffer() : null,
  ])

  await Promise.all([
    photo.thumbKey && newThumb ? uploadBuffer(photo.thumbKey, newThumb, "image/webp") : null,
    photo.displayKey && newDisplay ? uploadBuffer(photo.displayKey, newDisplay, "image/webp") : null,
    photo.watermarkedKey && newWm ? uploadBuffer(photo.watermarkedKey, newWm, "image/jpeg") : null,
  ])

  const newW = photo.height ?? photo.width
  const newH = photo.width ?? photo.height

  await db.update(photos)
    .set({ width: newW, height: newH })
    .where(eq(photos.id, photoId))

  revalidatePath(`/dashboard/galleries/${photo.galleryId}`)
  return { success: true }
}
