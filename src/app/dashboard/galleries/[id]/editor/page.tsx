import { requireAuth } from "@/lib/require-auth"
import { requireGalleryOwned } from "@/lib/db-guards"
import { db } from "@/db"
import { photos, stars, comments, selections, selectionPhotos } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { StudioShell } from "@/components/studio/studio-shell"

interface EditorPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    filter?: string
    selectionId?: string
    photoId?: string
  }>
}

export default async function GalleryEditorPage({ params, searchParams }: EditorPageProps) {
  const userId = await requireAuth()

  const { id: galleryId } = await params
  const { filter, selectionId, photoId } = await searchParams

  const gallery = await requireGalleryOwned(galleryId, userId)

  // Fetch all proofing photos for this gallery
  const galleryPhotos = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, galleryId), eq(photos.section, "proofing")),
    orderBy: [photos.sortOrder, photos.createdAt],
  })

  if (galleryPhotos.length === 0) {
    redirect(`/dashboard/galleries/${galleryId}?tab=photos`)
  }

  const photoIds = galleryPhotos.map((p) => p.id)

  // Fetch stars, comments, and selection sessions in parallel
  const [starsList, commentsList, selectionsList] = await Promise.all([
    db.query.stars.findMany({
      where: eq(stars.galleryId, galleryId),
    }),
    photoIds.length > 0
      ? db.query.comments.findMany({
          where: inArray(comments.photoId, photoIds),
        })
      : [],
    db.query.selections.findMany({
      where: eq(selections.galleryId, galleryId),
    }),
  ])

  // If selectionId is provided, get specific photo IDs in that selection
  let selectedSessionPhotoIds: Set<string> | null = null
  if (selectionId) {
    const selItems = await db.query.selectionPhotos.findMany({
      where: eq(selectionPhotos.selectionId, selectionId),
    })
    selectedSessionPhotoIds = new Set(selItems.map((s) => s.photoId))
  }

  // Build star count and comments maps
  const starCountMap = new Map<string, number>()
  starsList.forEach((s) => {
    starCountMap.set(s.photoId, (starCountMap.get(s.photoId) || 0) + 1)
  })

  const commentsMap = new Map<string, string[]>()
  commentsList.forEach((c) => {
    const list = commentsMap.get(c.photoId) || []
    list.push(c.body)
    commentsMap.set(c.photoId, list)
  })

  // Format photos for Studio
  const studioPhotos = galleryPhotos.map((p) => {
    const starCount = starCountMap.get(p.id) || 0
    const photoComments = commentsMap.get(p.id) || []
    const isSelectedInSession = selectedSessionPhotoIds ? selectedSessionPhotoIds.has(p.id) : false

    const displaySrc = p.displayKey
      ? `/api/s3/${p.displayKey}`
      : p.thumbKey
      ? `/api/s3/${p.thumbKey}`
      : `/api/s3/${p.originalKey}`

    const isRaw =
      p.mimeType?.includes("raw") ||
      /\.(arw|cr2|cr3|nef|dng|raf|orf|rw2)$/i.test(p.filename)

    return {
      id: p.id,
      title: p.filename.replace(/\.[^/.]+$/, ""),
      filename: p.filename,
      src: displaySrc,
      originalKey: p.originalKey,
      stars: starCount,
      comments: photoComments,
      isStarred: starCount > 0,
      isSelectedInSession,
      isRaw,
      width: p.width || 2000,
      height: p.height || 1500,
      aspectRatio: (p.width && p.height && p.width > p.height ? "3:2" : "2:3") as "3:2" | "2:3",
      savedEditRecipe: p.editRecipe ? JSON.parse(p.editRecipe) : null,
    }
  })

  return (
    <StudioShell
      gallery={{
        id: gallery.id,
        name: gallery.name,
        slug: gallery.slug,
        stage: gallery.stage,
      }}
      initialPhotos={studioPhotos}
      initialFilter={(filter as "all" | "starred") || (selectionId ? "starred" : "all")}
      initialPhotoId={photoId}
      selectionCount={selectionsList.length}
    />
  )
}
