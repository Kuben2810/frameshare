import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, storageConnections, workspaces } from "@/db/schema"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { googleDriveConnectionId } from "@/lib/google-drive"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return Response.json({ error: "Only the workspace owner can manage storage" }, { status: 403 })

  const assignedGallery = await db.query.galleries.findFirst({
    where: eq(galleries.storageConnectionId, googleDriveConnectionId(workspace.id)),
    columns: { id: true },
  })
  if (assignedGallery) {
    return Response.json({ error: "Move or delete galleries using Google Drive before disconnecting it" }, { status: 409 })
  }

  await db.transaction(async (tx) => {
    await tx.update(workspaces).set({ storageProvider: "managed", updatedAt: new Date() }).where(eq(workspaces.id, workspace.id))
    await tx.update(storageConnections).set({
      status: "disconnected",
      rootReference: null,
      credentialsCiphertext: null,
      lastCheckedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(storageConnections.id, googleDriveConnectionId(workspace.id)))
  })
  return Response.json({ ok: true })
}
