import { db } from "@/db"
import { galleries, photos, workspaceMembers } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { InferSelectModel } from "drizzle-orm"

export type Gallery = InferSelectModel<typeof galleries>
export type Photo = InferSelectModel<typeof photos>

type Executor = Pick<typeof db, "execute">

/** Adjust a workspace's storage_used_bytes by delta (positive = add, negative = subtract).
 *  Underflow guard (GREATEST 0) prevents the value going below zero on subtract.
 *  Pass a transaction as `executor` to run inside an existing transaction. */
export async function adjustStorageQuota(workspaceId: string, delta: number, executor: Executor = db): Promise<void> {
  await executor.execute(
    sql`UPDATE workspaces SET storage_used_bytes = GREATEST(0, storage_used_bytes + ${delta}), updated_at = NOW() WHERE id = ${workspaceId}`
  )
}

/** Atomically reserve storage only when the resulting usage remains within the limit. */
export async function reserveStorageQuota(
  workspaceId: string,
  bytes: number,
  limit: number,
  executor: Executor = db,
): Promise<boolean> {
  const result = await executor.execute(sql`
    UPDATE workspaces
    SET storage_used_bytes = storage_used_bytes + ${bytes}
    WHERE id = ${workspaceId}
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
  workspaceId: string,
  reservedBytes: number,
  actualBytes: number,
  limit: number,
  executor: Executor = db,
): Promise<boolean> {
  const result = await executor.execute(sql`
    UPDATE workspaces
    SET storage_used_bytes = storage_used_bytes - ${reservedBytes} + ${actualBytes}
    WHERE id = ${workspaceId}
      AND storage_used_bytes >= ${reservedBytes}
      AND storage_used_bytes - ${reservedBytes} + ${actualBytes} <= ${limit}
    RETURNING storage_used_bytes
  `)
  return result.rowCount === 1
}

export async function requireGalleryOwned(id: string, userId: string): Promise<Gallery> {
  const [result] = await db
    .select({ gallery: galleries })
    .from(galleries)
    .innerJoin(workspaceMembers, eq(galleries.workspaceId, workspaceMembers.workspaceId))
    .where(and(eq(galleries.id, id), eq(workspaceMembers.userId, userId)))
    .limit(1)
  if (!result) notFound()
  return result.gallery
}

export async function requirePhotoOwned(id: string, userId: string): Promise<Photo> {
  const [result] = await db
    .select({ photo: photos })
    .from(photos)
    .innerJoin(galleries, eq(photos.galleryId, galleries.id))
    .innerJoin(workspaceMembers, eq(galleries.workspaceId, workspaceMembers.workspaceId))
    .where(and(eq(photos.id, id), eq(workspaceMembers.userId, userId)))
    .limit(1)
  if (!result) notFound()
  return result.photo
}
