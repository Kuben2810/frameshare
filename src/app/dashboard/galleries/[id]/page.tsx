import { auth } from "@/auth"
import { db } from "@/db"
import { photos, selections } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { requireGalleryOwned } from "@/lib/db-guards"
import { GalleryDetailView } from "@/components/gallery-detail-view"
import { getBaseUrl } from "@/lib/utils"

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await requireGalleryOwned(id, session.user.id)

  const galleryPhotos = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, id), eq(photos.status, "ready")),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
  })

  const recentSelections = await db.query.selections.findMany({
    where: eq(selections.galleryId, id),
    orderBy: (s, { desc }) => [desc(s.submittedAt)],
    with: {
      selectionPhotos: {
        with: {
          photo: true,
        },
      },
    },
  })

  return (
    <GalleryDetailView
      gallery={gallery}
      photos={galleryPhotos}
      selections={recentSelections}
      baseUrl={getBaseUrl()}
    />
  )
}


