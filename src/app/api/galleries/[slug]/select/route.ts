import { db } from "@/db"
import { selections, selectionPhotos, selectionRateLimits, stars, photos } from "@/db/schema"
import { eq, and, inArray, sql } from "drizzle-orm"
import { sendSelectionNotificationEmail } from "@/lib/email"
import { users } from "@/db/schema"
import { authorizePublicGallery } from "@/lib/public-gallery-access"
import { createHmac } from "node:crypto"

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_SELECTION_SUBMISSIONS_PER_WINDOW = 3

function getVisitorHash(req: Request): string | null {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.AUTH_SECRET
  if (!secret) return null

  const forwardedFor = req.headers.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "unknown"

  return createHmac("sha256", secret).update(ipAddress).digest("hex")
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { clientId } = await req.json()
  if (typeof clientId !== "string" || !clientId || clientId.length > 200) {
    return Response.json({ error: "clientId required" }, { status: 400 })
  }

  const visitorHash = getVisitorHash(req)
  if (!visitorHash) {
    return Response.json({ error: "Selection service is not configured" }, { status: 503 })
  }

  const access = await authorizePublicGallery(slug)
  if ("response" in access) return access.response
  const { gallery } = access

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${gallery.id}:${clientId}`}))`)

    const [existingSelection] = await tx
      .select()
      .from(selections)
      .where(and(eq(selections.galleryId, gallery.id), eq(selections.clientId, clientId)))
      .limit(1)
    if (existingSelection) return { kind: "existing" as const, selection: existingSelection }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${gallery.id}:${visitorHash}`}))`)
    const now = new Date()
    const [rateLimit] = await tx
      .select()
      .from(selectionRateLimits)
      .where(and(
        eq(selectionRateLimits.galleryId, gallery.id),
        eq(selectionRateLimits.visitorHash, visitorHash),
      ))
      .limit(1)

    if (rateLimit && now.getTime() - rateLimit.windowStartedAt.getTime() < RATE_LIMIT_WINDOW_MS) {
      if (rateLimit.attempts >= MAX_SELECTION_SUBMISSIONS_PER_WINDOW) {
        return { kind: "rate_limited" as const }
      }
      await tx
        .update(selectionRateLimits)
        .set({ attempts: rateLimit.attempts + 1 })
        .where(and(
          eq(selectionRateLimits.galleryId, gallery.id),
          eq(selectionRateLimits.visitorHash, visitorHash),
        ))
    } else if (rateLimit) {
      await tx
        .update(selectionRateLimits)
        .set({ windowStartedAt: now, attempts: 1 })
        .where(and(
          eq(selectionRateLimits.galleryId, gallery.id),
          eq(selectionRateLimits.visitorHash, visitorHash),
        ))
    } else {
      await tx.insert(selectionRateLimits).values({
        galleryId: gallery.id,
        visitorHash,
        windowStartedAt: now,
        attempts: 1,
      })
    }

    const starred = await tx
      .select({ photoId: stars.photoId })
      .from(stars)
      .where(and(eq(stars.galleryId, gallery.id), eq(stars.clientId, clientId)))
    const starredPhotoIds = starred.map((star) => star.photoId)
    if (starredPhotoIds.length === 0) return { kind: "error" as const, error: "No photos selected" }

    const validPhotos = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(and(
        inArray(photos.id, starredPhotoIds),
        eq(photos.galleryId, gallery.id),
        eq(photos.status, "ready"),
        eq(photos.section, "proofing"),
      ))
    const photoIds = validPhotos.map((photo) => photo.id)
    if (photoIds.length !== starredPhotoIds.length) {
      return { kind: "error" as const, error: "Selection contains unavailable photos" }
    }
    if (gallery.maxSelections !== null && photoIds.length > gallery.maxSelections) {
      return { kind: "error" as const, error: `Selection limit of ${gallery.maxSelections} exceeded` }
    }

    const [selection] = await tx.insert(selections).values({
      id: crypto.randomUUID(),
      galleryId: gallery.id,
      clientId,
    }).returning()

    await tx.insert(selectionPhotos).values(
      photoIds.map((photoId) => ({ selectionId: selection.id, photoId }))
    )
    return { kind: "created" as const, selection, photoCount: photoIds.length }
  })

  if (result.kind === "rate_limited") {
    return Response.json({ error: "Too many selection submissions. Please try again later." }, { status: 429 })
  }
  if (result.kind === "error") return Response.json({ error: result.error }, { status: 409 })
  if (result.kind === "existing") return Response.json({ selection: result.selection, alreadySubmitted: true })

  // Notify photographer with luxury formatted email
  const photographer = await db.query.users.findFirst({ where: eq(users.id, gallery.userId) })
  if (photographer?.email) {
    sendSelectionNotificationEmail({
      photographerEmail: photographer.email,
      photographerName: photographer.name ?? "Photographer",
      galleryName: gallery.name,
      galleryId: gallery.id,
      slug,
      photoCount: result.photoCount,
    }).catch(() => {}) // non-fatal
  }

  return Response.json({ selection: result.selection })
}
