import { db } from "@/db"
import { galleries, photos, stars, comments, workspaces } from "@/db/schema"
import { eq, and, asc, inArray, or } from "drizzle-orm"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { GalleryView } from "@/components/gallery-view"
import { PasswordGate } from "@/components/password-gate"
import { toPublicGallery, toPublicPhoto } from "@/lib/public-gallery"
import { requireGalleryWorkspaceAccess } from "@/lib/workspace"

export default async function GallerySharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params


  const decodedSlug = decodeURIComponent(slug).trim()

  const gallery = await db.query.galleries.findFirst({
    where: or(
      eq(galleries.slug, decodedSlug),
      eq(galleries.id, decodedSlug)
    ),
  })
  if (!gallery) notFound()

  const session = await auth()
  const isOwner = !!(session?.user?.id && await requireGalleryWorkspaceAccess(gallery.id, session.user.id))
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, gallery.workspaceId),
    columns: { logoKey: true, accentColor: true },
  })

  // Check expiry
  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) {
    if (!isOwner) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold">Gallery Expired</h1>
            <p className="text-sm text-neutral-400">This gallery is no longer available.</p>
          </div>
        </div>
      )
    }
  }

  // Check password
  if (gallery.passwordHash) {
    const cookieStore = await cookies()
    const isUnlocked = cookieStore.get(`gallery_unlocked_${gallery.id}`)?.value === "1"

    if (!isOwner && !isUnlocked) {
      return <PasswordGate galleryId={gallery.id} galleryName={gallery.name} />
    }
  }

  const PAGE = 60
  const galleryPhotosRaw = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, gallery.id), eq(photos.status, "ready")),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
    limit: PAGE + 1,
  })
  const hasMore = galleryPhotosRaw.length > PAGE
  const galleryPhotos = galleryPhotosRaw.slice(0, PAGE)

  const galleryStars = await db.query.stars.findMany({
    where: eq(stars.galleryId, gallery.id),
  })

  const allComments = galleryPhotos.length > 0
    ? await db.query.comments.findMany({
        where: inArray(comments.photoId, galleryPhotos.map((p) => p.id)),
        orderBy: [asc(comments.createdAt)],
      })
    : []

  return (
    <GalleryView
      gallery={toPublicGallery({
        ...gallery,
        logoKey: gallery.logoKey ?? workspace?.logoKey ?? null,
        accentColor: gallery.accentColor ?? workspace?.accentColor ?? null,
      })}
      photos={galleryPhotos.map(toPublicPhoto)}
      initialStars={galleryStars}
      initialComments={allComments}
      gallerySlug={gallery.slug}
      hasMore={hasMore}
    />
  )
}
