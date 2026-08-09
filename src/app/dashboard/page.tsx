import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Images } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export default async function DashboardPage() {
  const session = await auth()
  const userGalleries = await db.query.galleries.findMany({
    where: eq(galleries.userId, session!.user!.id!),
    orderBy: (g, { desc }) => [desc(g.createdAt)],
  })

  // Fetch cover photo for each gallery in parallel
  const coverMap: Record<string, string | null> = {}
  if (userGalleries.length > 0) {
    const covers = await Promise.all(
      userGalleries.map((g) =>
        db.query.photos.findFirst({
          where: and(eq(photos.galleryId, g.id), eq(photos.status, "ready")),
          orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
          columns: { thumbKey: true },
        })
      )
    )
    userGalleries.forEach((g, i) => {
      coverMap[g.id] = covers[i]?.thumbKey ?? null
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Galleries</h1>
        <Link href="/dashboard/galleries/new" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
          <Plus className="h-3.5 w-3.5" />
          New gallery
        </Link>
      </div>

      {userGalleries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Images className="h-6 w-6 opacity-40" />
          </div>
          <p className="text-sm font-medium text-foreground">No galleries yet</p>
          <p className="text-xs mt-1">Create your first gallery to start sharing with clients.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {userGalleries.map((g) => {
            const thumbKey = coverMap[g.id]
            return (
              <Link key={g.id} href={`/dashboard/galleries/${g.id}`} className="group block">
                <div className="overflow-hidden rounded-lg bg-card ring-1 ring-border transition-all duration-200 group-hover:ring-primary/25 group-hover:shadow-lg">
                  {/* Cover — full bleed, photo-first */}
                  <div className="aspect-[4/3] bg-muted overflow-hidden relative">
                    {thumbKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/s3/${encodeURIComponent(thumbKey)}`}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Images className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  {/* Proof label */}
                  <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-foreground leading-snug">{g.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(g.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {g.expiresAt && new Date(g.expiresAt) < new Date() && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1.5 py-0">Expired</Badge>
                      )}
                      {g.passwordHash && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">Protected</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
