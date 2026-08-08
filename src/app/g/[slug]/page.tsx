import { db } from "@/db"
import { galleries, photos, stars, comments } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { notFound } from "next/navigation"
import { GalleryView } from "@/components/gallery-view"

export default async function GallerySharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ pw?: string }>
}) {
  const { slug } = await params
  const { pw } = await searchParams

  const gallery = await db.query.galleries.findFirst({ where: eq(galleries.slug, slug) })
  if (!gallery) notFound()

  // Check expiry
  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">This gallery has expired.</p>
      </div>
    )
  }

  // Check password
  if (gallery.passwordHash) {
    const bcrypt = await import("bcryptjs")
    const valid = pw && await bcrypt.compare(pw, gallery.passwordHash)
    if (!valid) {
      return <PasswordGate slug={slug} />
    }
  }

  const galleryPhotos = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, gallery.id), eq(photos.status, "ready")),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
  })

  const galleryStars = await db.query.stars.findMany({
    where: eq(stars.galleryId, gallery.id),
  })

  const galleryComments = await db.query.comments.findMany({
    where: eq(
      comments.photoId,
      // get all photo ids
      galleryPhotos[0]?.id ?? ""
    ),
  })

  // Fetch all comments for all photos
  const allComments = galleryPhotos.length > 0
    ? await db.query.comments.findMany({
        where: (c, { inArray }) => inArray(c.photoId, galleryPhotos.map((p) => p.id)),
        orderBy: [asc(comments.createdAt)],
      })
    : []

  return (
    <GalleryView
      gallery={gallery}
      photos={galleryPhotos}
      initialStars={galleryStars}
      initialComments={allComments}
    />
  )
}

function PasswordGate({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-center">This gallery is password protected</h1>
        <form className="space-y-3">
          <input type="hidden" name="_slug" value={slug} />
          <input
            name="pw"
            type="password"
            placeholder="Enter password"
            className="w-full border rounded-md px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="submit"
            formAction={async (fd: FormData) => {
              "use server"
              const { redirect } = await import("next/navigation")
              redirect(`/g/${fd.get("_slug")}?pw=${fd.get("pw")}`)
            }}
            className="w-full bg-black text-white rounded-md px-3 py-2 text-sm font-medium hover:bg-neutral-800"
          >
            View gallery
          </button>
        </form>
      </div>
    </div>
  )
}
