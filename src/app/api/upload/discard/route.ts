import { auth } from "@/auth"
import { discardUploadPhoto } from "@/lib/upload-cleanup"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { photoId } = await req.json().catch(() => ({}))
  if (typeof photoId !== "string") return Response.json({ error: "photoId required" }, { status: 400 })

  try {
    // A direct browser upload can fail after the sign route has reserved
    // quota. Release only the caller's still-retryable pending/error record.
    await discardUploadPhoto(photoId, session.user.id, ["pending", "error"])
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Upload cleanup failed" }, { status: 500 })
  }
}
