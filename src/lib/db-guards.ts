import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { InferSelectModel } from "drizzle-orm"
import { ensureColumnsMigrated } from "@/db/auto-migrate"

export type Gallery = InferSelectModel<typeof galleries>
export type Photo = InferSelectModel<typeof photos>

type Executor = Pick<typeof db, "execute">

/** Adjust a user's storage_used_bytes by delta (positive = add, negative = subtract).
 *  Underflow guard (GREATEST 0) prevents the value going below zero on subtract.
 *  Pass a transaction as `executor` to run inside an existing transaction. */
export async function adjustStorageQuota(userId: string, delta: number, executor: Executor = db): Promise<void> {
  await executor.execute(
    sql`UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes + ${delta}) WHERE id = ${userId}`
  )
}

export async function requireGalleryOwned(id: string, userId: string): Promise<Gallery> {
  await ensureColumnsMigrated()
  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, userId)),
  })
  if (!gallery) notFound()
  return gallery
}

export async function requirePhotoOwned(id: string, userId: string): Promise<Photo> {
  const photo = await db.query.photos.findFirst({
    where: and(eq(photos.id, id), eq(photos.userId, userId)),
  })
  if (!photo) notFound()
  return photo
}
