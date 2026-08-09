import { auth } from "@/auth"
import { db } from "@/db"
import { photos } from "@/db/schema"
import { eq } from "drizzle-orm"
import { processPhoto } from "@/lib/process-photo"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { photoId } = await req.json()

  const photo = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
  if (!photo || photo.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  if (photo.status !== "pending") {
    return Response.json({ error: "Already processed" }, { status: 409 })
  }

  try {
    await processPhoto(photoId)
    const updated = await db.query.photos.findFirst({ where: eq(photos.id, photoId) })
    return Response.json({ photo: updated })
  } catch (err) {
    await db.update(photos).set({ status: "error" }).where(eq(photos.id, photoId))
    console.error("Processing error", err)
    return Response.json({ error: "Processing failed" }, { status: 500 })
  }
}
