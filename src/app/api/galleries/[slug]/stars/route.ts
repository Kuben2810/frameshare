import { db } from "@/db"
import { stars, photos } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { authorizePublicGallery } from "@/lib/public-gallery-access"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, clientId } = await req.json()
  if (typeof photoId !== "string" || typeof clientId !== "string" || !clientId || clientId.length > 200) {
    return Response.json({ error: "photoId and clientId are required" }, { status: 400 })
  }

  const access = await authorizePublicGallery(slug)
  if ("response" in access) return access.response
  const { gallery } = access

  const photo = await db.query.photos.findFirst({
    where: and(
      eq(photos.id, photoId),
      eq(photos.galleryId, gallery.id),
      eq(photos.status, "ready"),
      eq(photos.section, "proofing"),
    ),
  })
  if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 })

  const result = await db.transaction(async (tx) => {
    // Serialize mutations from one client in one gallery so the count check
    // and insert cannot race past maxSelections.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${gallery.id}:${clientId}`}))`)

    const [existing] = await tx
      .select({ id: stars.id })
      .from(stars)
      .where(and(eq(stars.photoId, photoId), eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId)))
      .limit(1)
    if (existing) return { starred: true }

    if (gallery.maxSelections !== null) {
      const [selectionCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(stars)
        .where(and(eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId)))
      if (selectionCount.count >= gallery.maxSelections) return { starred: false, limitReached: true }
    }

    await tx.insert(stars).values({
      id: crypto.randomUUID(),
      photoId,
      galleryId: gallery.id,
      clientId,
    })
    return { starred: true }
  })

  if (result.limitReached) {
    return Response.json({ error: `Selection limit of ${gallery.maxSelections} reached` }, { status: 409 })
  }

  return Response.json(result)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, clientId } = await req.json()
  if (typeof photoId !== "string" || typeof clientId !== "string" || !clientId || clientId.length > 200) {
    return Response.json({ error: "photoId and clientId are required" }, { status: 400 })
  }

  const access = await authorizePublicGallery(slug)
  if ("response" in access) return access.response
  const { gallery } = access

  await db.delete(stars).where(
    and(eq(stars.photoId, photoId), eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId))
  )

  return Response.json({ starred: false })
}
