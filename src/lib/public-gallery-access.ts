import { auth } from "@/auth"
import { db } from "@/db"
import { galleries } from "@/db/schema"
import { eq, or } from "drizzle-orm"
import { cookies } from "next/headers"
import { requireGalleryWorkspaceAccess } from "@/lib/workspace"

type AccessResult =
  | { gallery: NonNullable<Awaited<ReturnType<typeof db.query.galleries.findFirst>>>; isOwner: boolean }
  | { response: Response }

/**
 * Authorizes a request made through a public gallery link. Owners retain
 * access to their own expired or password-protected galleries.
 */
export async function authorizePublicGallery(slug: string): Promise<AccessResult> {
  let decodedSlug: string
  try {
    decodedSlug = decodeURIComponent(slug).trim()
  } catch {
    return { response: Response.json({ error: "Not found" }, { status: 404 }) }
  }

  const gallery = await db.query.galleries.findFirst({
    where: or(eq(galleries.slug, decodedSlug), eq(galleries.id, decodedSlug)),
  })
  if (!gallery) return { response: Response.json({ error: "Not found" }, { status: 404 }) }

  const session = await auth()
  const isOwner = !!(session?.user?.id && await requireGalleryWorkspaceAccess(gallery.id, session.user.id))
  if (isOwner) return { gallery, isOwner }

  if (gallery.expiresAt && gallery.expiresAt < new Date()) {
    return { response: Response.json({ error: "Gallery has expired" }, { status: 403 }) }
  }

  if (gallery.passwordHash) {
    const cookieStore = await cookies()
    const isUnlocked = cookieStore.get(`gallery_unlocked_${gallery.id}`)?.value === "1"
    if (!isUnlocked) return { response: Response.json({ error: "Gallery is locked" }, { status: 401 }) }
  }

  return { gallery, isOwner }
}
