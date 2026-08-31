"use server"

import { db } from "@/db"
import { galleries, photos, workspaceMembers } from "@/db/schema"
import { auth } from "@/auth"
import { eq, and } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { requireAuth } from "@/lib/require-auth"
import { deleteKey, downloadBuffer, uploadBuffer } from "@/lib/s3"
import { s3Keys } from "@/lib/s3-keys"
import { adjustStorageQuota, requireGalleryOwned, requirePhotoOwned } from "@/lib/db-guards"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { PhotoEditRecipe } from "@/lib/ai-photo-analyzer"
import { renderEditedPhotoBuffer } from "@/lib/render-edited-photo"
import sharp from "sharp"

function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

export async function createGallery(formData: FormData) {
  const userId = await requireAuth()
  const { workspace } = await ensureActiveWorkspace(userId)

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
    workspaceId: workspace.id,
    name,
    slug: randomSlug(),
    logoKey: workspace.logoKey,
    accentColor: workspace.accentColor,
    passwordHash,
    expiresAt,
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full") ?? "none",
    stage,
    maxSelections,
  })

  redirect(`/dashboard/galleries/${id}`)
}

export async function updateGallery(id: string, formData: FormData): Promise<{ error: string } | void> {
  const userId = await requireAuth()

  const gallery = await requireGalleryOwned(id, userId)

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

  const rawSlug = (formData.get("slug") as string | null)?.trim()
  let newSlug = gallery.slug
  if (rawSlug && rawSlug !== gallery.slug) {
    const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    if (cleanSlug) {
      const existing = await db.query.galleries.findFirst({
        where: eq(galleries.slug, cleanSlug),
      })
      if (!existing || existing.id === id) {
        newSlug = cleanSlug
      }
    }
  }

  await db.update(galleries).set({
    name: (formData.get("name") as string).trim(),
    slug: newSlug,
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full"),
    expiresAt,
    stage,
    maxSelections,
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  }).where(eq(galleries.id, id))

  revalidatePath(`/dashboard/galleries/${id}`)
  revalidatePath(`/dashboard/galleries/${id}/settings`)
  revalidatePath(`/g/${gallery.slug}`)
  if (newSlug !== gallery.slug) {
    revalidatePath(`/g/${newSlug}`)
  }
}

export async function updateGalleryStage(
  id: string,
  stage: "proofing" | "delivered" | "both",
): Promise<{ success: true } | { error: string }> {
  const userId = await requireAuth()

  const gallery = await requireGalleryOwned(id, userId)

  await db.update(galleries).set({ stage }).where(eq(galleries.id, id))
  revalidatePath(`/dashboard/galleries/${id}`)
  revalidatePath(`/g/${gallery.slug}`)
  return { success: true }
}

export async function movePhotosToSection(galleryId: string, photoIds: string[], targetSection: "proofing" | "final") {
  const userId = await requireAuth()

  const gallery = await requireGalleryOwned(galleryId, userId)

  if (photoIds.length === 0) return { success: true }

  for (const pid of photoIds) {
    await db.update(photos).set({ section: targetSection }).where(and(eq(photos.id, pid), eq(photos.galleryId, galleryId)))
  }

  revalidatePath(`/dashboard/galleries/${galleryId}`)
  revalidatePath(`/g/${gallery.slug}`)
  return { success: true }
}

export async function deleteGallery(id: string) {
  const userId = await requireAuth()

  const gallery = await requireGalleryOwned(id, userId)

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
  await db.delete(galleries).where(eq(galleries.id, id))

  // Decrement workspace storage
  if (totalBytes > 0) {
    await adjustStorageQuota(gallery.workspaceId, -totalBytes)
  }

  redirect("/dashboard")
}

export async function updatePhotoOrder(galleryId: string, orderedIds: string[]) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await requireGalleryOwned(galleryId, session.user.id)

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

  const photo = await requirePhotoOwned(photoId, session.user.id)

  const gallery = await db.query.galleries.findFirst({
    where: eq(galleries.id, photo.galleryId),
    columns: { workspaceId: true },
  })
  if (!gallery) return { error: "Gallery not found" }

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

  // Decrement workspace storage
  await adjustStorageQuota(gallery.workspaceId, -photo.fileSizeBytes)

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

  const photo = await requirePhotoOwned(photoId, userId)

  const [thumbBuf, displayBuf, wmBuf] = await Promise.all([
    photo.thumbKey ? downloadBuffer(photo.thumbKey) : null,
    photo.displayKey ? downloadBuffer(photo.displayKey) : null,
    photo.watermarkedKey ? downloadBuffer(photo.watermarkedKey) : null,
  ])

  const [newThumb, newDisplay, newWm] = await Promise.all([
    thumbBuf ? sharp(thumbBuf).rotate(angle).webp({ quality: 90, effort: 4 }).toBuffer() : null,
    displayBuf ? sharp(displayBuf).rotate(angle).webp({ quality: 92, effort: 4 }).toBuffer() : null,
    wmBuf ? sharp(wmBuf).rotate(angle).jpeg({ quality: 88, mozjpeg: true }).toBuffer() : null,
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

export async function savePhotoEditAction(
  galleryId: string,
  photoId: string,
  recipe: PhotoEditRecipe,
  saveAsFinal = false
) {
  const userId = await requireAuth()

  const photo = await requirePhotoOwned(photoId, userId)

  const serializedRecipe = JSON.stringify(recipe)

  // 1. Update editRecipe on source proofing photo
  await db
    .update(photos)
    .set({ editRecipe: serializedRecipe })
    .where(eq(photos.id, photoId))

  // 2. If saveAsFinal requested, render high-res master and publish to "final" section
  if (saveAsFinal) {
    try {
      const originalBuffer = await downloadBuffer(photo.originalKey)
      if (originalBuffer) {
        const rendered = await renderEditedPhotoBuffer(originalBuffer, photo.filename, recipe)

        const finalPhotoId = `final-${photo.id}`
        const finalMasterKey = s3Keys(finalPhotoId).finalMaster()
        const finalDisplayKey = s3Keys(finalPhotoId).finalDisplay()
        const finalThumbKey = s3Keys(finalPhotoId).thumb()

        await Promise.all([
          uploadBuffer(finalMasterKey, rendered.masterJpeg, "image/jpeg"),
          uploadBuffer(finalDisplayKey, rendered.displayWebp, "image/webp"),
          uploadBuffer(finalThumbKey, rendered.thumbWebp, "image/webp"),
        ])

        // Upsert final photo record in database
        const existingFinal = await db.query.photos.findFirst({
          where: and(eq(photos.sourcePhotoId, photoId), eq(photos.section, "final")),
        })

        if (existingFinal) {
          await db
            .update(photos)
            .set({
              originalKey: finalMasterKey,
              displayKey: finalDisplayKey,
              thumbKey: finalThumbKey,
              width: rendered.width,
              height: rendered.height,
              fileSizeBytes: rendered.masterJpeg.length,
              editRecipe: serializedRecipe,
              status: "ready",
            })
            .where(eq(photos.id, existingFinal.id))
        } else {
          await db.insert(photos).values({
            id: finalPhotoId,
            galleryId: photo.galleryId,
            userId,
            section: "final",
            sourcePhotoId: photoId,
            originalKey: finalMasterKey,
            displayKey: finalDisplayKey,
            thumbKey: finalThumbKey,
            filename: `final-${photo.filename.replace(/\.[^/.]+$/, "")}.jpg`,
            mimeType: "image/jpeg",
            fileSizeBytes: rendered.masterJpeg.length,
            width: rendered.width,
            height: rendered.height,
            editRecipe: serializedRecipe,
            status: "ready",
            sortOrder: photo.sortOrder,
          })
        }
      }
    } catch (renderErr) {
      console.error("Error rendering final photo:", renderErr)
      return { error: "Failed to render high-res final photo" }
    }
  }

  revalidatePath(`/dashboard/galleries/${galleryId}`)
  revalidatePath(`/dashboard/galleries/${galleryId}/editor`)
  return { success: true }
}

export async function batchSavePhotoEditsAction(
  galleryId: string,
  photoIds: string[],
  recipe: PhotoEditRecipe,
  saveAsFinal = false
) {
  const userId = await requireAuth()

  const serializedRecipe = JSON.stringify(recipe)

  for (const photoId of photoIds) {
    const photo = await db
      .select({ photo: photos })
      .from(photos)
      .innerJoin(galleries, eq(photos.galleryId, galleries.id))
      .innerJoin(workspaceMembers, eq(galleries.workspaceId, workspaceMembers.workspaceId))
      .where(and(eq(photos.id, photoId), eq(workspaceMembers.userId, userId)))
      .limit(1)
      .then(([result]) => result?.photo)
    if (!photo) continue

    await db
      .update(photos)
      .set({ editRecipe: serializedRecipe })
      .where(eq(photos.id, photoId))

    if (saveAsFinal) {
      try {
        const originalBuffer = await downloadBuffer(photo.originalKey)
        if (originalBuffer) {
          const rendered = await renderEditedPhotoBuffer(originalBuffer, photo.filename, recipe)
          const finalPhotoId = `final-${photo.id}`
          const finalMasterKey = s3Keys(finalPhotoId).finalMaster()
          const finalDisplayKey = s3Keys(finalPhotoId).finalDisplay()
          const finalThumbKey = s3Keys(finalPhotoId).thumb()

          await Promise.all([
            uploadBuffer(finalMasterKey, rendered.masterJpeg, "image/jpeg"),
            uploadBuffer(finalDisplayKey, rendered.displayWebp, "image/webp"),
            uploadBuffer(finalThumbKey, rendered.thumbWebp, "image/webp"),
          ])

          const existingFinal = await db.query.photos.findFirst({
            where: and(eq(photos.sourcePhotoId, photoId), eq(photos.section, "final")),
          })

          if (existingFinal) {
            await db
              .update(photos)
              .set({
                originalKey: finalMasterKey,
                displayKey: finalDisplayKey,
                thumbKey: finalThumbKey,
                width: rendered.width,
                height: rendered.height,
                fileSizeBytes: rendered.masterJpeg.length,
                editRecipe: serializedRecipe,
                status: "ready",
              })
              .where(eq(photos.id, existingFinal.id))
          } else {
            await db.insert(photos).values({
              id: finalPhotoId,
              galleryId: photo.galleryId,
              userId,
              section: "final",
              sourcePhotoId: photoId,
              originalKey: finalMasterKey,
              displayKey: finalDisplayKey,
              thumbKey: finalThumbKey,
              filename: `final-${photo.filename.replace(/\.[^/.]+$/, "")}.jpg`,
              mimeType: "image/jpeg",
              fileSizeBytes: rendered.masterJpeg.length,
              width: rendered.width,
              height: rendered.height,
              editRecipe: serializedRecipe,
              status: "ready",
              sortOrder: photo.sortOrder,
            })
          }
        }
      } catch (err) {
        console.error(`Batch render failed for photo ${photoId}:`, err)
      }
    }
  }

  revalidatePath(`/dashboard/galleries/${galleryId}`)
  revalidatePath(`/dashboard/galleries/${galleryId}/editor`)
  return { success: true, count: photoIds.length, error: undefined as string | undefined }
}

