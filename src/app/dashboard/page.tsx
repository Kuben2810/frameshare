import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos, selections, users, stars } from "@/db/schema"
import { eq, and, asc, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { DashboardClientView, DashboardGallery } from "@/components/dashboard-client-view"
import { getBaseUrl } from "@/lib/utils"
import { ensureColumnsMigrated } from "@/db/auto-migrate"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  await ensureColumnsMigrated()

  const [user, userGalleries] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db.query.galleries.findMany({
      where: eq(galleries.userId, session.user.id),
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
    }),
  ])

  if (!user) redirect("/login")

  const [totalPhotosPerGallery, starsPerGallery] = await Promise.all([
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
  ])

  // Compute exact storage from active ready photos and auto-sync with user record
  const readyPhotosTotalBytes = totalPhotosPerGallery.reduce(
    (sum, pList) => sum + pList.reduce((pSum, p) => pSum + (p.fileSizeBytes || 0), 0),
    0
  )

  if (user.storageUsedBytes !== readyPhotosTotalBytes) {
    await db.update(users).set({ storageUsedBytes: readyPhotosTotalBytes }).where(eq(users.id, user.id))
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

  const storageUsedBytes = readyPhotosTotalBytes
  const storageLimitBytes = Number(process.env.STORAGE_LIMIT_BYTES ?? 10_737_418_240)

  return (
    <DashboardClientView
      userName={user?.name ?? session.user.name ?? "Photographer"}
      galleries={dashboardGalleries}
      storageUsedBytes={storageUsedBytes}
      storageLimitBytes={storageLimitBytes}
      baseUrl={getBaseUrl()}
    />
  )
}

