import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos, selections, stars, workspaces } from "@/db/schema"
import { eq, and, asc, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { DashboardClientView, DashboardGallery } from "@/components/dashboard-client-view"
import { getBaseUrl } from "@/lib/utils"
import { ensureActiveWorkspace } from "@/lib/workspace"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { workspace } = await ensureActiveWorkspace(session.user.id)
  if (!workspace.onboardingCompletedAt) redirect("/onboarding")

  const userGalleries = await db.query.galleries.findMany({
    where: eq(galleries.workspaceId, workspace.id),
    orderBy: [desc(galleries.createdAt)],
    with: {
      photos: {
        where: eq(photos.status, "ready"),
        orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
        columns: { thumbKey: true },
        limit: 4,
      },
      selections: {
        columns: { id: true },
        with: {
          selectionPhotos: {
            columns: { photoId: true },
          },
        },
      },
    },
  })

  const [totalPhotosPerGallery, starsPerGallery, storagePhotos] = await Promise.all([
    Promise.all(
      userGalleries.map((g) =>
        db.query.photos.findMany({
          where: and(eq(photos.galleryId, g.id), eq(photos.status, "ready")),
          columns: { id: true, fileSizeBytes: true },
        })
      )
    ),
    Promise.all(
      userGalleries.map((g) =>
        db.query.stars.findMany({
          where: eq(stars.galleryId, g.id),
          columns: { photoId: true },
        })
      )
    ),
    db
      .select({ fileSizeBytes: photos.fileSizeBytes })
      .from(photos)
      .innerJoin(galleries, eq(photos.galleryId, galleries.id))
      .where(eq(galleries.workspaceId, workspace.id)),
  ])

  // Pending/error rows retain a reservation until they are retried or stale
  // cleanup removes them, so they must be included in the source of truth.
  const storedPhotosTotalBytes = storagePhotos.reduce(
    (sum, photo) => sum + (photo.fileSizeBytes || 0),
    0,
  )

  if (workspace.storageUsedBytes !== storedPhotosTotalBytes) {
    await db.update(workspaces).set({ storageUsedBytes: storedPhotosTotalBytes, updatedAt: new Date() }).where(eq(workspaces.id, workspace.id))
  }

  const dashboardGalleries: DashboardGallery[] = userGalleries.map((g, index) => {
    // Collect all unique selected / starred photo IDs
    const selectedPhotoIdSet = new Set<string>()
    for (const sel of g.selections) {
      for (const sp of sel.selectionPhotos) {
        if (sp.photoId) selectedPhotoIdSet.add(sp.photoId)
      }
    }
    for (const st of starsPerGallery[index] ?? []) {
      if (st.photoId) selectedPhotoIdSet.add(st.photoId)
    }

    return {
      id: g.id,
      name: g.name,
      slug: g.slug,
      passwordHash: g.passwordHash,
      expiresAt: g.expiresAt,
      downloadMode: g.downloadMode,
      createdAt: g.createdAt,
      photosCount: totalPhotosPerGallery[index].length,
      coverThumbKey: g.photos[0]?.thumbKey ?? null,
      previewThumbs: g.photos.map((p: { thumbKey: string | null }) => p.thumbKey).filter((k: string | null): k is string => Boolean(k)),
      selectionsCount: g.selections.length,
      selectedPhotosCount: selectedPhotoIdSet.size,
    }
  })

  const storageUsedBytes = storedPhotosTotalBytes
  const storageLimitBytes = Number(process.env.STORAGE_LIMIT_BYTES ?? 10_737_418_240)

  return (
    <DashboardClientView
      userName={workspace.name}
      galleries={dashboardGalleries}
      storageUsedBytes={storageUsedBytes}
      storageLimitBytes={storageLimitBytes}
      baseUrl={getBaseUrl()}
    />
  )
}

