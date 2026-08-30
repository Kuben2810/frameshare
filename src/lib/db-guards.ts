import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { InferSelectModel } from "drizzle-orm"

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

/** Atomically reserve storage only when the resulting usage remains within the limit. */
export async function reserveStorageQuota(
  userId: string,
  bytes: number,
  limit: number,
  executor: Executor = db,
): Promise<boolean> {
  const result = await executor.execute(sql`
    UPDATE users
    SET storage_used_bytes = storage_used_bytes + ${bytes}
    WHERE id = ${userId}
      AND storage_used_bytes + ${bytes} <= ${limit}
    RETURNING storage_used_bytes
  `)
  return result.rowCount === 1
}

/**
 * Replace a pending upload's declared reservation with the verified object
 * size. The same conditional update prevents an oversized object from
 * bypassing the storage limit.
 */
export async function reconcileStorageReservation(
  userId: string,
  reservedBytes: number,
  actualBytes: number,
  limit: number,
  executor: Executor = db,
): Promise<boolean> {
  const result = await executor.execute(sql`
    UPDATE users
    SET storage_used_bytes = storage_used_bytes - ${reservedBytes} + ${actualBytes}
    WHERE id = ${userId}
      AND storage_used_bytes >= ${reservedBytes}
      AND storage_used_bytes - ${reservedBytes} + ${actualBytes} <= ${limit}
    RETURNING storage_used_bytes
  `)
  return result.rowCount === 1
}

export async function requireGalleryOwned(id: string, userId: string): Promise<Gallery> {
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
