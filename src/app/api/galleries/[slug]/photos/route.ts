import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { eq, and, asc, or } from "drizzle-orm"
import { cookies } from "next/headers"
import { auth } from "@/auth"

const LIMIT = 60

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10))

  const decodedSlug = decodeURIComponent(slug).trim()
  const gallery = await db.query.galleries.findFirst({
    where: or(eq(galleries.slug, decodedSlug), eq(galleries.id, decodedSlug)),
  })
  if (!gallery) return Response.json({ error: "Not found" }, { status: 404 })

  const session = await auth()
  const isOwner = !!(session?.user?.id && session.user.id === gallery.userId)

  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date() && !isOwner) {
    return Response.json({ error: "Expired" }, { status: 403 })
  }

  if (gallery.passwordHash && !isOwner) {
    const cookieStore = await cookies()
    const isUnlocked = cookieStore.get(`gallery_unlocked_${gallery.id}`)?.value === "1"
    if (!isUnlocked) return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const page = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, gallery.id), eq(photos.status, "ready")),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
    limit: LIMIT + 1,
    offset,
  })

  const hasMore = page.length > LIMIT
  return Response.json({ photos: page.slice(0, LIMIT), hasMore })
}
