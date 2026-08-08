import { createGallery } from "@/app/actions/galleries"
// ponytail: cast needed because createGallery returns {error} on validation fail;
// form action type requires void. Errors will be handled via useActionState later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createGalleryAction = createGallery as any
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewGalleryPage() {
  return (
    <div className="max-w-lg space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Galleries
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>New gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGalleryAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Gallery name</Label>
              <Input id="name" name="name" required placeholder="Wedding — Sarah & Tom" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="downloadMode">Client downloads</Label>
              <select
                id="downloadMode"
                name="downloadMode"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                defaultValue="none"
              >
                <option value="none">No downloads</option>
                <option value="lowres">Low-res with watermark</option>
                <option value="full">Full resolution</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password (optional)</Label>
              <Input id="password" name="password" type="text" placeholder="Leave blank for no password" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="expiresAt">Link expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>

            <Button type="submit" className="w-full">Create gallery</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
