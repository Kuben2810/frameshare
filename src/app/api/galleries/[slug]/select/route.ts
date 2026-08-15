import { db } from "@/db"
import { selections, selectionPhotos, galleries, stars } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { sendSelectionNotificationEmail } from "@/lib/email"
import { users } from "@/db/schema"
import { getBaseUrl } from "@/lib/utils"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { clientId } = await req.json()
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 })

  const gallery = await db.query.galleries.findFirst({ where: eq(galleries.slug, slug) })
  if (!gallery) return Response.json({ error: "Not found" }, { status: 404 })

  // Snapshot starred photo IDs for this client
  const starred = await db.query.stars.findMany({
    where: and(eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId)),
  })
  const photoIds = starred.map((s) => s.photoId)

  const [selection] = await db.insert(selections).values({
    id: crypto.randomUUID(),
    galleryId: gallery.id,
  }).returning()

  if (photoIds.length > 0) {
    await db.insert(selectionPhotos).values(
      photoIds.map((photoId) => ({ selectionId: selection.id, photoId }))
    )
  }

  // Notify photographer with luxury formatted email
  const photographer = await db.query.users.findFirst({ where: eq(users.id, gallery.userId) })
  if (photographer?.email) {
    sendSelectionNotificationEmail({
      photographerEmail: photographer.email,
      photographerName: photographer.name ?? "Photographer",
      galleryName: gallery.name,
      galleryId: gallery.id,
      slug,
      photoCount: photoIds.length,
    }).catch(() => {}) // non-fatal
  }

  return Response.json({ selection })
}
