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
import { deleteKey } from "@/lib/s3"
import { s3Keys } from "@/lib/s3-keys"
import { deleteMediaObject, downloadMediaBuffer, getGalleryStorageConnection, uploadMediaBuffer } from "@/lib/media-storage"
import { adjustStorageQuota, requireGalleryOwned, requirePhotoOwned } from "@/lib/db-guards"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { getWorkspaceStorageConnection } from "@/lib/storage-connection"
import { PhotoEditRecipe } from "@/lib/ai-photo-analyzer"
import { renderEditedPhotoBuffer } from "@/lib/render-edited-photo"
import sharp from "sharp"

function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

function generatedMediaName(connectionProvider: "managed" | "google_drive" | "s3", managedKey: string, driveName: string) {
  return connectionProvider === "managed" ? managedKey : driveName
}

async function saveFinalRenderedPhoto(
  photo: typeof photos.$inferSelect,
  userId: string,
  serializedRecipe: string,
  rendered: Awaited<ReturnType<typeof renderEditedPhotoBuffer>>,
) {
  const storageConnection = await getGalleryStorageConnection(photo.galleryId)
  const finalPhotoId = `final-${photo.id}`
  const managedKeys = s3Keys(finalPhotoId)
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const [finalMasterKey, finalDisplayKey, finalThumbKey] = await Promise.all([
    uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, managedKeys.finalMaster(), `Frameshare-${finalPhotoId}-${suffix}-master.jpg`), rendered.masterJpeg, "image/jpeg"),
    uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, managedKeys.finalDisplay(), `Frameshare-${finalPhotoId}-${suffix}-display.webp`), rendered.displayWebp, "image/webp"),
    uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, managedKeys.thumb(), `Frameshare-${finalPhotoId}-${suffix}-thumb.webp`), rendered.thumbWebp, "image/webp"),
  ])

  const existingFinal = await db.query.photos.findFirst({
    where: and(eq(photos.sourcePhotoId, photo.id), eq(photos.section, "final")),
  })

  if (existingFinal) {
    const replacedKeys = [existingFinal.originalKey, existingFinal.displayKey, existingFinal.thumbKey]
      .filter((key): key is string => Boolean(key))
      .filter((key) => ![finalMasterKey, finalDisplayKey, finalThumbKey].includes(key))
    await db.update(photos).set({
      originalKey: finalMasterKey,
      displayKey: finalDisplayKey,
      thumbKey: finalThumbKey,
      width: rendered.width,
      height: rendered.height,
      fileSizeBytes: rendered.masterJpeg.length,
      editRecipe: serializedRecipe,
      status: "ready",
    }).where(eq(photos.id, existingFinal.id))
    await Promise.allSettled(replacedKeys.map((key) => deleteMediaObject(storageConnection, key)))
    return
  }

  await db.insert(photos).values({
    id: finalPhotoId,
    galleryId: photo.galleryId,
    userId,
    section: "final",
    sourcePhotoId: photo.id,
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

export async function createGallery(formData: FormData) {
  const userId = await requireAuth()
  const { workspace } = await ensureActiveWorkspace(userId)
  const storageConnection = await getWorkspaceStorageConnection(workspace.id)

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
    storageConnectionId: storageConnection.id,
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

  const storageConnection = await getGalleryStorageConnection(gallery.id)
  const mediaKeys: string[] = []
  if (gallery.logoKey) {
    await deleteKey(gallery.logoKey).catch(() => undefined)
  }
  for (const p of galleryPhotos) {
    if (p.originalKey) mediaKeys.push(p.originalKey)
    if (p.thumbKey) mediaKeys.push(p.thumbKey)
    if (p.displayKey) mediaKeys.push(p.displayKey)
    if (p.watermarkedKey) mediaKeys.push(p.watermarkedKey)
  }

  await Promise.allSettled(
    mediaKeys.map(async (key) => {
      try {
        await deleteMediaObject(storageConnection, key)
      } catch (err) {
        console.error(`Failed to delete gallery media ${key}:`, err)
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
  const storageConnection = await getGalleryStorageConnection(photo.galleryId)

  const keysToDelete = [
    photo.originalKey,
    photo.thumbKey,
    photo.displayKey,
    photo.watermarkedKey,
  ].filter((k): k is string => Boolean(k))

  // Delete photo from database
  await db.delete(photos).where(eq(photos.id, photoId))

  await Promise.allSettled(
    keysToDelete.map(async (key) => {
      try {
        await deleteMediaObject(storageConnection, key)
      } catch (err) {
        console.error(`Failed to delete photo media ${key}:`, err)
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
  const storageConnection = await getGalleryStorageConnection(photo.galleryId)

  const [thumbBuf, displayBuf, wmBuf] = await Promise.all([
    photo.thumbKey ? downloadMediaBuffer(storageConnection, photo.thumbKey) : null,
    photo.displayKey ? downloadMediaBuffer(storageConnection, photo.displayKey) : null,
    photo.watermarkedKey ? downloadMediaBuffer(storageConnection, photo.watermarkedKey) : null,
  ])

  const [newThumb, newDisplay, newWm] = await Promise.all([
    thumbBuf ? sharp(thumbBuf).rotate(angle).webp({ quality: 90, effort: 4 }).toBuffer() : null,
    displayBuf ? sharp(displayBuf).rotate(angle).webp({ quality: 92, effort: 4 }).toBuffer() : null,
    wmBuf ? sharp(wmBuf).rotate(angle).jpeg({ quality: 88, mozjpeg: true }).toBuffer() : null,
  ])

  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const [thumbKey, displayKey, watermarkedKey] = await Promise.all([
    photo.thumbKey && newThumb ? uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, photo.thumbKey, `Frameshare-${photo.id}-${suffix}-thumb.webp`), newThumb, "image/webp") : null,
    photo.displayKey && newDisplay ? uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, photo.displayKey, `Frameshare-${photo.id}-${suffix}-display.webp`), newDisplay, "image/webp") : null,
    photo.watermarkedKey && newWm ? uploadMediaBuffer(storageConnection, generatedMediaName(storageConnection.provider, photo.watermarkedKey, `Frameshare-${photo.id}-${suffix}-watermarked.jpg`), newWm, "image/jpeg") : null,
  ])
  const replacedKeys = [photo.thumbKey, photo.displayKey, photo.watermarkedKey]
    .filter((key): key is string => Boolean(key))
    .filter((key) => ![thumbKey, displayKey, watermarkedKey].includes(key))
  await Promise.allSettled(replacedKeys.map((key) => deleteMediaObject(storageConnection, key)))

  const newW = photo.height ?? photo.width
  const newH = photo.width ?? photo.height

  await db.update(photos)
    .set({
      width: newW,
      height: newH,
      ...(thumbKey ? { thumbKey } : {}),
      ...(displayKey ? { displayKey } : {}),
      ...(watermarkedKey ? { watermarkedKey } : {}),
    })
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
      const storageConnection = await getGalleryStorageConnection(photo.galleryId)
      const originalBuffer = await downloadMediaBuffer(storageConnection, photo.originalKey)
      if (originalBuffer) {
        const rendered = await renderEditedPhotoBuffer(originalBuffer, photo.filename, recipe)
        await saveFinalRenderedPhoto(photo, userId, serializedRecipe, rendered)
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
        const storageConnection = await getGalleryStorageConnection(photo.galleryId)
        const originalBuffer = await downloadMediaBuffer(storageConnection, photo.originalKey)
        if (originalBuffer) {
          const rendered = await renderEditedPhotoBuffer(originalBuffer, photo.filename, recipe)
          await saveFinalRenderedPhoto(photo, userId, serializedRecipe, rendered)
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

