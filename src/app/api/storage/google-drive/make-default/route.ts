import { auth } from "@/auth"
import { db } from "@/db"
import { storageConnections, workspaces } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { ensureActiveWorkspace } from "@/lib/workspace"

export const runtime = "nodejs"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return Response.json({ error: "Only the workspace owner can manage storage" }, { status: 403 })

  const connection = await db.query.storageConnections.findFirst({
    where: and(
      eq(storageConnections.workspaceId, workspace.id),
      eq(storageConnections.provider, "google_drive"),
      eq(storageConnections.status, "active"),
    ),
  })
  if (!connection?.rootReference) return Response.json({ error: "Connect and verify a Google Drive folder first" }, { status: 409 })

  await db.update(workspaces).set({
    storageProvider: "google_drive",
    updatedAt: new Date(),
  }).where(eq(workspaces.id, workspace.id))
  return Response.json({ ok: true })
}
