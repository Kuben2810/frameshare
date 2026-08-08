"use server"

import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { auth } from "@/auth"
import { eq, and, sql } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

export async function createGallery(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const name = (formData.get("name") as string).trim()
  if (!name) return { error: "Name required" }

  const rawPassword = formData.get("password") as string | null
  const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null

  const expiresAtRaw = formData.get("expiresAt") as string | null
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null

  const id = crypto.randomUUID()
  await db.insert(galleries).values({
    id,
    userId: session.user.id,
    name,
    slug: randomSlug(),
    passwordHash,
    expiresAt,
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full") ?? "none",
  })

  redirect(`/dashboard/galleries/${id}`)
}

export async function updateGallery(id: string, formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) return { error: "Not found" }

  const rawPassword = formData.get("password") as string | null
  const passwordHash = rawPassword
    ? await bcrypt.hash(rawPassword, 10)
    : rawPassword === "" ? null : undefined

  const expiresAtRaw = formData.get("expiresAt") as string | null
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null

  await db.update(galleries).set({
    name: (formData.get("name") as string).trim(),
    downloadMode: (formData.get("downloadMode") as "none" | "lowres" | "full"),
    expiresAt,
    ...(passwordHash !== undefined ? { passwordHash } : {}),
  }).where(eq(galleries.id, id))

  revalidatePath(`/dashboard/galleries/${id}`)
}

export async function deleteGallery(id: string) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  await db.delete(galleries).where(
    and(eq(galleries.id, id), eq(galleries.userId, session.user.id))
  )
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

  await db.delete(photos).where(eq(photos.id, photoId))

  // release quota
  await db.update(galleries).set({}).where(eq(galleries.id, photo.galleryId))
  // ponytail: quota decrement via raw sql to avoid a round-trip read
  await db.execute(
    sql`UPDATE users SET storage_used_bytes = storage_used_bytes - ${photo.fileSizeBytes} WHERE id = ${session.user.id}`
  )

  revalidatePath(`/dashboard/galleries/${photo.galleryId}`)
}
