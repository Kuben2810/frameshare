import { db } from "@/db"
import { stars, galleries, photos } from "@/db/schema"
import { eq, and, or } from "drizzle-orm"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, clientId } = await req.json()
  if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 })

  const decodedSlug = decodeURIComponent(slug).trim()
  const gallery = await db.query.galleries.findFirst({
    where: or(eq(galleries.slug, decodedSlug), eq(galleries.id, decodedSlug)),
  })
  if (!gallery) return Response.json({ error: "Not found" }, { status: 404 })

  await db.insert(stars).values({
    id: crypto.randomUUID(),
    photoId,
    galleryId: gallery.id,
    clientId,
  }).onConflictDoNothing()

  return Response.json({ starred: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, clientId } = await req.json()

  const decodedSlug = decodeURIComponent(slug).trim()
  const gallery = await db.query.galleries.findFirst({
    where: or(eq(galleries.slug, decodedSlug), eq(galleries.id, decodedSlug)),
  })
  if (!gallery) return Response.json({ error: "Not found" }, { status: 404 })

  await db.delete(stars).where(
    and(eq(stars.photoId, photoId), eq(stars.clientId, clientId))
  )

  return Response.json({ starred: false })
}
