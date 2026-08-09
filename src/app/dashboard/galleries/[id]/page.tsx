import { auth } from "@/auth"
import { db } from "@/db"
import { galleries, photos, selections } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { CopyButton } from "@/components/copy-button"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { GalleryEditor } from "@/components/gallery-editor"
import { cn } from "@/lib/utils"

export default async function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) notFound()

  const galleryPhotos = await db.query.photos.findMany({
    where: and(eq(photos.galleryId, id), eq(photos.status, "ready")),
    orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
  })

  const recentSelections = await db.query.selections.findMany({
    where: eq(selections.galleryId, id),
    orderBy: (s, { desc }) => [desc(s.submittedAt)],
    limit: 5,
  })

  const shareUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/g/${gallery.slug}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Galleries
          </Link>
          <h1 className="text-2xl font-semibold">{gallery.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Downloads: <strong>{gallery.downloadMode}</strong></span>
            {gallery.passwordHash && <Badge variant="outline" className="text-xs">Password protected</Badge>}
            {gallery.expiresAt && (
              <Badge variant={new Date(gallery.expiresAt) < new Date() ? "destructive" : "outline"} className="text-xs">
                Expires {new Date(gallery.expiresAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={shareUrl} target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1")}>
            <ExternalLink className="h-3.5 w-3.5" /> Preview
          </Link>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground flex-1 truncate font-mono">{shareUrl}</span>
        <CopyButton text={shareUrl} />
      </div>

      <Separator />

      <GalleryEditor gallery={gallery} photos={galleryPhotos} />

      {recentSelections.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Client selections</h2>
          <div className="space-y-2">
            {recentSelections.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">
                  {new Date(s.submittedAt).toLocaleString()} — {s.photoIds.length} photo{s.photoIds.length !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

