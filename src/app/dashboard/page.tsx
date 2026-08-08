import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos } from "@/db/schema"
import { eq, count } from "drizzle-orm"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Galleries</h1>
        <Link href="/dashboard/galleries/new" className={cn(buttonVariants(), "inline-flex items-center")}>
          <Plus className="h-4 w-4 mr-2" />
          New gallery
        </Link>
      </div>

      {userGalleries.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Images className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No galleries yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userGalleries.map((g) => (
            <Link key={g.id} href={`/dashboard/galleries/${g.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-video bg-neutral-100 rounded-md flex items-center justify-center">
                    <Images className="h-8 w-8 text-neutral-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-snug line-clamp-1">{g.name}</span>
                      {g.expiresAt && new Date(g.expiresAt) < new Date() && (
                        <Badge variant="destructive" className="shrink-0 text-xs">Expired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(g.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
