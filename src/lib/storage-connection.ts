import { db } from "@/db"
import { storageConnections, workspaces } from "@/db/schema"
import { and, eq } from "drizzle-orm"

export const GIBIBYTE = 1024 * 1024 * 1024

export const storageEntitlements = {
  trial: { quotaBytes: 5 * GIBIBYTE, label: "5 GB trial" },
  studio: { quotaBytes: 250 * GIBIBYTE, label: "250 GB managed storage" },
} as const

export function managedStorageConnectionId(workspaceId: string) {
  return `managed:${workspaceId}`
}

export function managedStorageConnection(workspaceId: string) {
  return {
    id: managedStorageConnectionId(workspaceId),
    workspaceId,
    provider: "managed" as const,
    label: "Frameshare managed storage",
    status: "active" as const,
    lastCheckedAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Resolves the connection selected for new galleries. The managed adapter is
 * live today; a disconnected or future BYO provider must never receive an
 * upload until its own adapter has passed a health check.
 */
export async function getWorkspaceStorageConnection(workspaceId: string) {
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!workspace) throw new Error("Workspace does not exist")

  if (workspace.storageProvider === "managed") {
    const connectionId = managedStorageConnectionId(workspaceId)
    await db.insert(storageConnections).values(managedStorageConnection(workspaceId)).onConflictDoNothing()
    const connection = await db.query.storageConnections.findFirst({ where: eq(storageConnections.id, connectionId) })
    if (!connection) throw new Error("Managed storage connection could not be created")
    return connection
  }

  const connection = await db.query.storageConnections.findFirst({
    where: and(
      eq(storageConnections.workspaceId, workspaceId),
      eq(storageConnections.provider, workspace.storageProvider),
      eq(storageConnections.status, "active"),
    ),
  })
  if (!connection) throw new Error("Connect and verify storage before creating a gallery")
  return connection
}
