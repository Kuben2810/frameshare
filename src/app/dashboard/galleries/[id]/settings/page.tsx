import { auth } from "@/auth"
import { db } from "@/db"
import { galleries } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { updateGallery, deleteGallery } from "@/app/actions/galleries"
import { ArrowLeft, Trash2, SlidersHorizontal, Lock, Calendar, Download } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function GallerySettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const gallery = await db.query.galleries.findFirst({
    where: and(eq(galleries.id, id), eq(galleries.userId, session.user.id)),
  })
  if (!gallery) notFound()

  const updateAction = updateGallery.bind(null, id) as unknown as (fd: FormData) => Promise<void>
  const deleteAction = deleteGallery.bind(null, id) as unknown as () => Promise<void>

  const expiresAtValue = gallery.expiresAt
    ? new Date(gallery.expiresAt).toISOString().split("T")[0]
    : ""

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      <Link
        href={`/dashboard/galleries/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Collection</span>
      </Link>

      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-foreground font-oswald uppercase">
          {gallery.name} Settings
        </h1>
      </div>

      <div className="rounded-2xl bg-card border border-border/80 p-6 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">General Configuration</h3>
        <form action={updateAction} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Collection Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={gallery.name}
              required
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="slug" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom Proofing URL Slug
            </label>
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus-within:ring-2 focus-within:ring-primary/40">
              <span className="text-muted-foreground font-mono text-xs select-none">/g/</span>
              <input
                id="slug"
                name="slug"
                defaultValue={gallery.slug}
                placeholder="vanity-slug-name"
                className="w-full bg-transparent text-sm focus:outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Direct client link: <span className="font-mono text-primary">/g/{gallery.slug}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="downloadMode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client Download Policy
            </label>
            <select
              id="downloadMode"
              name="downloadMode"
              defaultValue={gallery.downloadMode}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            >
              <option value="none">No downloads (Proofing only)</option>
              <option value="lowres">Low-res with watermark</option>
              <option value="full">Full resolution files</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Passcode Protection
            </label>
            <input
              id="password"
              name="password"
              type="text"
              placeholder={gallery.passwordHash ? "Password set (enter new password to change, empty to clear)" : "Leave blank for public access"}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="expiresAt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Link Expiration Date
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={expiresAtValue}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={cn(buttonVariants({ size: "default" }), "rounded-xl font-medium shadow-xs")}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <h4 className="text-sm font-bold text-destructive flex items-center gap-1.5">
          <Trash2 className="h-4 w-4" /> Danger Zone
        </h4>
        <p className="text-xs text-muted-foreground">
          Permanently delete this collection and all its uploaded photos. This action cannot be reversed.
        </p>
        <form action={deleteAction}>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "rounded-xl mt-2")}
          >
            Delete Collection
          </button>
        </form>
      </div>
    </div>
  )
}

