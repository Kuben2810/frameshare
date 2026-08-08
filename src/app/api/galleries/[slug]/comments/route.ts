import { db } from "@/db"
import { comments, galleries } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { photoId, body, authorName } = await req.json()
  if (!body?.trim()) return Response.json({ error: "Body required" }, { status: 400 })

  const gallery = await db.query.galleries.findFirst({ where: eq(galleries.slug, slug) })
  if (!gallery) return Response.json({ error: "Not found" }, { status: 404 })

  const [comment] = await db.insert(comments).values({
    id: crypto.randomUUID(),
    photoId,
    body: body.trim(),
    authorName: authorName?.trim() || null,
  }).returning()

  return Response.json({ comment })
}
