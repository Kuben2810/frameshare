import { auth } from "@/auth"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { getGoogleDriveAccessToken, googleDrivePickerConfigured } from "@/lib/google-drive"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const { workspace, role } = await ensureActiveWorkspace(session.user.id)
  if (role !== "owner") return Response.json({ error: "Only the workspace owner can manage storage" }, { status: 403 })
  if (!googleDrivePickerConfigured()) return Response.json({ error: "Google Drive Picker is not configured" }, { status: 409 })

  try {
    const accessToken = await getGoogleDriveAccessToken(workspace.id)
    return Response.json({ accessToken }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ error: "Google Drive needs to be reconnected" }, { status: 409 })
  }
}
