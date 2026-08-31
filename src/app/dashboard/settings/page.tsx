import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { updateAccount, uploadAccountLogo } from "@/app/actions/account"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { storageConnections } from "@/db/schema"
import { db } from "@/db"
import { and, eq } from "drizzle-orm"
import { googleDriveConfigured } from "@/lib/google-drive"
import { GoogleDriveConnectionCard } from "@/components/google-drive-connection-card"
import { ArrowLeft, User, Palette, Image as ImageIcon, HardDrive, Check, Upload, Sparkles } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { workspace } = await ensureActiveWorkspace(session.user.id)
  const googleDriveConnection = await db.query.storageConnections.findFirst({
    columns: {
      status: true,
      label: true,
      rootReference: true,
      lastError: true,
    },
    where: and(
      eq(storageConnections.workspaceId, workspace.id),
      eq(storageConnections.provider, "google_drive"),
    ),
  })

  const storageUsedMB = (workspace.storageUsedBytes / (1024 * 1024)).toFixed(1)
  const storageLimitGB = (workspace.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(0)
  const usagePct = Math.min(100, Math.round((workspace.storageUsedBytes / workspace.storageQuotaBytes) * 100))
  const storagePlanLabel = workspace.storagePlan === "studio" ? "Studio" : workspace.storagePlan === "byo_storage" ? "BYO Storage" : "Trial"

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 w-full">
      <div className="max-w-3xl space-y-8 pb-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Collections</span>
        </Link>

        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Studio Profile
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-foreground font-oswald uppercase">
            Studio & Branding Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Customize your studio identity, custom watermark branding, accent palette, and monitor storage limits.
          </p>
        </div>

        <div className="grid gap-6">
          {/* ── Profile & Accent Color Card ── */}
          <div className="rounded-2xl bg-card border border-border/80 p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">Photographer Profile</h3>
            </div>

            <form action={updateAccount} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Display / Studio Name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={workspace.name}
                  required
                  placeholder="e.g. Elena Vance Photography"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  Used in watermarks, client gallery headers, and proofing notifications.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <label htmlFor="accentColor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Gallery Accent Color</span>
                  <span className="text-muted-foreground font-mono text-[11px]">{workspace.accentColor ?? "#000000"}</span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    id="accentColor"
                    name="accentColor"
                    type="color"
                    defaultValue={workspace.accentColor ?? "#000000"}
                    className="h-10 w-16 cursor-pointer rounded-xl border border-border bg-background p-1 shadow-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    Custom highlight & button color shown to your clients in public gallery views.
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className={cn(buttonVariants({ size: "default" }), "rounded-xl font-medium shadow-xs")}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>

          {/* ── Studio Logo Card ── */}
          <div className="rounded-2xl bg-card border border-border/80 p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
              <ImageIcon className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">Studio Brand Logo</h3>
            </div>

            {workspace.logoKey && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/s3/${workspace.logoKey}`}
                  alt="Logo"
                  className="h-12 w-auto max-w-[140px] object-contain rounded-lg bg-black/20 p-2 border border-white/10"
                />
                <div>
                  <p className="text-xs font-bold text-foreground">Current Active Logo</p>
                  <p className="text-[11px] text-muted-foreground">Displayed in the header and sidebar of all client galleries.</p>
                </div>
              </div>
            )}

            <form action={uploadAccountLogo as unknown as (fd: FormData) => Promise<void>} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="logo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Upload New Studio Logo
                </label>
                <input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <p className="text-[11px] text-muted-foreground">
                  High-resolution PNG or SVG with transparent background recommended. Max 5 MB.
                </p>
              </div>

              <button
                type="submit"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl gap-1.5")}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Logo</span>
              </button>
            </form>
          </div>

          {/* ── Storage Capacity Card ── */}
          <div className="rounded-2xl bg-card border border-border/80 p-6 md:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
              <HardDrive className="h-4 w-4 text-primary" />
              <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">Storage Plan & Quota</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground tabular-nums text-base">{storageUsedMB} MB</span>
                  <span className="text-xs text-muted-foreground block">Current usage</span>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="font-bold text-foreground text-base">{storageLimitGB} GB</span>
                  <span className="text-xs text-muted-foreground block">{storagePlanLabel} plan · {usagePct}% used</span>
                </div>
              </div>

              <div className="h-3 rounded-full bg-muted overflow-hidden p-0.5 border border-border/40">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 shadow-xs"
                  style={{ width: `${usagePct}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Storage includes original high-resolution camera files, web-display previews, and client watermarked derivatives.
              </p>
              <p className="text-xs text-muted-foreground">
                Your current gallery files use Frameshare managed storage. Google Drive connections will be available for new galleries once connected and verified.
              </p>
            </div>
          </div>

          <GoogleDriveConnectionCard
            connection={googleDriveConnection ?? null}
            configured={googleDriveConfigured()}
            pickerApiKey={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_PICKER_API_KEY?.trim() || null}
          />
        </div>
      </div>
    </div>
  </div>
)
}
