import { auth } from "@/auth"
import { db } from "@/db"
import { galleries } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { updateGallery, deleteGallery } from "@/app/actions/galleries"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

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
    <div className="max-w-lg space-y-6">
      <Link href={`/dashboard/galleries/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to gallery
      </Link>

      <h1 className="text-2xl font-semibold">Gallery settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent>
          <form action={updateAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Gallery name</Label>
              <Input id="name" name="name" defaultValue={gallery.name} required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="downloadMode">Client downloads</Label>
              <select
                id="downloadMode"
                name="downloadMode"
                defaultValue={gallery.downloadMode}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="none">No downloads</option>
                <option value="lowres">Low-res with watermark</option>
                <option value="full">Full resolution</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="text" placeholder="Leave blank to keep current, clear to remove" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="expiresAt">Link expires</Label>
              <Input id="expiresAt" name="expiresAt" type="date" defaultValue={expiresAtValue} />
            </div>

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-base text-destructive">Danger zone</CardTitle></CardHeader>
        <CardContent>
          <form action={deleteAction}>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete this gallery and all its photos. This cannot be undone.
            </p>
            <Button type="submit" variant="destructive">Delete gallery</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
