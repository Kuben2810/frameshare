import { db } from "@/db"
import { galleries, storageConnections, users, workspaceMembers, workspaces } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { managedStorageConnection } from "@/lib/storage-connection"

export type WorkspaceRole = "owner" | "editor" | "viewer"

export type ActiveWorkspace = {
  workspace: typeof workspaces.$inferSelect
  role: WorkspaceRole
}

function defaultWorkspaceName(user: Pick<typeof users.$inferSelect, "name" | "email">) {
  return user.name?.trim() || user.email.split("@")[0] || "My Studio"
}

function defaultWorkspaceSlug(userId: string) {
  return `studio-${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}`
}

async function findActiveWorkspace(userId: string): Promise<ActiveWorkspace | null> {
  const [membership] = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaceMembers.createdAt))
    .limit(1)

  if (!membership) return null
  return {
    workspace: membership.workspace,
    role: membership.role,
  }
}

/**
 * Returns the user's sole workspace today and provisions a personal workspace
 * exactly once for accounts created after the workspace migration.
 */
export async function ensureActiveWorkspace(userId: string): Promise<ActiveWorkspace> {
  const existing = await findActiveWorkspace(userId)
  if (existing) return existing

  await db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) throw new Error("Authenticated user does not exist")

    // Reusing the user ID gives first-time provisioning a deterministic key,
    // so concurrent first requests cannot create two default workspaces.
    await tx.insert(workspaces).values({
      id: user.id,
      name: defaultWorkspaceName(user),
      slug: defaultWorkspaceSlug(user.id),
    }).onConflictDoNothing()

    await tx.insert(workspaceMembers).values({
      workspaceId: user.id,
      userId: user.id,
      role: "owner",
    }).onConflictDoNothing()

    await tx.insert(storageConnections).values(managedStorageConnection(user.id)).onConflictDoNothing()
  })

  const provisioned = await findActiveWorkspace(userId)
  if (!provisioned) throw new Error("Could not provision a workspace")
  return provisioned
}

export async function requireGalleryWorkspaceAccess(galleryId: string, userId: string) {
  const [result] = await db
    .select({ gallery: galleries, workspace: workspaces, role: workspaceMembers.role })
    .from(galleries)
    .innerJoin(workspaceMembers, eq(galleries.workspaceId, workspaceMembers.workspaceId))
    .innerJoin(workspaces, eq(galleries.workspaceId, workspaces.id))
    .where(and(eq(galleries.id, galleryId), eq(workspaceMembers.userId, userId)))
    .limit(1)

  return result ?? null
}
