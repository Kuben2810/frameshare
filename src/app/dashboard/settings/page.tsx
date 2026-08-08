import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { updateAccount, uploadAccountLogo } from "@/app/actions/account"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
  if (!user) redirect("/login")

  const storageUsedMB = (user.storageUsedBytes / 1024 / 1024).toFixed(1)
  const storageLimitGB = (Number(process.env.STORAGE_LIMIT_BYTES ?? 10_737_418_240) / 1024 / 1024 / 1024).toFixed(0)
  const usagePct = Math.min(100, (user.storageUsedBytes / Number(process.env.STORAGE_LIMIT_BYTES ?? 10_737_418_240)) * 100)

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <h1 className="text-2xl font-semibold">Account settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent>
          <form action={updateAccount} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" defaultValue={user.name ?? ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accentColor">Gallery accent color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="accentColor"
                  name="accentColor"
                  type="color"
                  defaultValue={user.accentColor ?? "#000000"}
                  className="h-9 w-16 cursor-pointer rounded border px-1 py-1"
                />
                <span className="text-sm text-muted-foreground">Used as button color in client galleries</span>
              </div>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Gallery logo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {user.logoKey && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/s3/${user.logoKey}`} alt="Logo" className="h-12 w-auto object-contain border rounded p-1" />
              <span className="text-sm text-muted-foreground">Current logo</span>
            </div>
          )}
          <form action={uploadAccountLogo as unknown as (fd: FormData) => Promise<void>} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="logo">Upload new logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/*" />
              <p className="text-xs text-muted-foreground">PNG or SVG recommended. Max 5 MB. Shown in all your galleries.</p>
            </div>
            <Button type="submit" variant="outline">Upload logo</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Storage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{storageUsedMB} MB used</span>
            <span className="text-muted-foreground">{storageLimitGB} GB limit</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
