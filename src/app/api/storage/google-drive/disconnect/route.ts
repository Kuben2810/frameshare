import { auth } from "@/auth"
import { db } from "@/db"
import { storageConnections } from "@/db/schema"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { googleDriveConnectionId } from "@/lib/google-drive"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return Response.json({ error: "Only the workspace owner can manage storage" }, { status: 403 })

  await db.update(storageConnections).set({
    status: "disconnected",
    rootReference: null,
    credentialsCiphertext: null,
    lastCheckedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(storageConnections.id, googleDriveConnectionId(workspace.id)))
  return Response.json({ ok: true })
}
