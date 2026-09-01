import { db } from "@/db"
import { comments, photos } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { authorizePublicGallery } from "@/lib/public-gallery-access"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, body, authorName } = await req.json()
  if (typeof photoId !== "string" || typeof body !== "string" || !body.trim()) {
    return Response.json({ error: "photoId and body are required" }, { status: 400 })
  }

  const access = await authorizePublicGallery(slug)
  if ("response" in access) return access.response

  const photo = await db.query.photos.findFirst({
    where: and(
      eq(photos.id, photoId),
      eq(photos.galleryId, access.gallery.id),
      eq(photos.status, "ready"),
      eq(photos.section, "proofing"),
    ),
  })
  if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 })

  const [comment] = await db.insert(comments).values({
    id: crypto.randomUUID(),
    photoId,
    body: body.trim(),
    authorName: typeof authorName === "string" ? authorName.trim() || null : null,
  }).returning()

  return Response.json({ comment })
}
