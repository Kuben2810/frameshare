import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos, selections, users } from "@/db/schema"
import { eq, asc, desc } from "drizzle-orm"
import { redirect } from "next/navigation"
import { DashboardClientView, DashboardGallery } from "@/components/dashboard-client-view"
import { getBaseUrl } from "@/lib/utils"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

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
        },
      },
    }),
  ])

  if (!user) redirect("/login")

  const totalPhotosPerGallery = await Promise.all(
    userGalleries.map((g) =>
      db.query.photos.findMany({
        where: eq(photos.galleryId, g.id),
        columns: { id: true },
      })
    )
  )

  const dashboardGalleries: DashboardGallery[] = userGalleries.map((g, index) => ({
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
  }))

  const storageUsedBytes = user?.storageUsedBytes ?? 0
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

