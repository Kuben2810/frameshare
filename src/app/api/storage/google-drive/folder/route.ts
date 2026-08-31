import { auth } from "@/auth"
import { db } from "@/db"
import { storageConnections } from "@/db/schema"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { getGoogleDriveAccessToken, googleDriveConnectionId, verifyGoogleDriveFolder } from "@/lib/google-drive"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return Response.json({ error: "Only the workspace owner can manage storage" }, { status: 403 })

  const body = await request.json().catch(() => null) as { folderId?: unknown } | null
  const folderId = typeof body?.folderId === "string" ? body.folderId.trim() : ""
  if (!folderId || folderId.length > 256) return Response.json({ error: "A Google Drive folder is required" }, { status: 400 })

  try {
    const accessToken = await getGoogleDriveAccessToken(workspace.id)
    const folder = await verifyGoogleDriveFolder(accessToken, folderId)
    await db.update(storageConnections).set({
      label: `Google Drive — ${folder.name}`,
      rootReference: folder.id,
      status: "active",
      lastCheckedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(storageConnections.id, googleDriveConnectionId(workspace.id)))
    return Response.json({ folder })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Frameshare could not verify that folder. Reconnect Drive or choose another folder."
    console.error("Google Drive folder verification failed", error)
    return Response.json({ error: message }, { status: 409 })
  }
}
