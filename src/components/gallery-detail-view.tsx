"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Calendar,
  Download,
  Sparkles,
  Images,
  SlidersHorizontal,
  FileSpreadsheet,
  Trash2,
  Eye,
  Layers,
  Clock,
  Shield,
  CheckCircle2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { GalleryEditor } from "@/components/gallery-editor"
import { updateGallery, deleteGallery } from "@/app/actions/galleries"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, selections, selectionPhotos } from "@/db/schema"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>
type Selection = InferSelectModel<typeof selections> & {
  selectionPhotos: (InferSelectModel<typeof selectionPhotos> & { photo?: Photo | null })[]
}

interface GalleryDetailViewProps {
  gallery: Gallery
  photos: Photo[]
  selections: Selection[]
  baseUrl: string
}

export function GalleryDetailView({
  gallery,
  photos: initialPhotos,
  selections: initialSelections,
  baseUrl,
}: GalleryDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"photos" | "selections" | "settings">("photos")
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedFilenamesId, setCopiedFilenamesId] = useState<string | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const shareUrl = `${baseUrl}/g/${gallery.slug}`
  const isExpired = gallery.expiresAt ? new Date(gallery.expiresAt) < new Date() : false
  const isProtected = Boolean(gallery.passwordHash)

  // Total album size in MB
  const totalSizeBytes = initialPhotos.reduce((sum, p) => sum + (p.fileSizeBytes || 0), 0)
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(1)

  async function handleCopyLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopiedLink(true)
    toast.success("Gallery link copied to clipboard")
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleCopyLightroomFilenames(selection: Selection) {
    const filenames = selection.selectionPhotos
      .map((sp) => sp.photo?.filename)
      .filter((f): f is string => Boolean(f))

    if (filenames.length === 0) {
      toast.error("No photos found in this selection")
      return
    }

    const text = filenames.join(", ")
    await navigator.clipboard.writeText(text)
    setCopiedFilenamesId(selection.id)
    toast.success(`Copied ${filenames.length} filenames for Lightroom / Capture One filter!`)
    setTimeout(() => setCopiedFilenamesId(null), 2500)
  }

  async function handleSettingsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSavingSettings(true)
    const formData = new FormData(e.currentTarget)
    try {
      const res = await updateGallery(gallery.id, formData)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Gallery settings saved")
      }
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSavingSettings(false)
    }
  }

  const expiresAtValue = gallery.expiresAt
    ? new Date(gallery.expiresAt).toISOString().split("T")[0]
    : ""

  return (
    <div className="space-y-8 pb-16">
      {/* ── Top Navigation & Back Link ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Collections</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {initialPhotos.length > 0 && (
            <a
              href={`/api/galleries/${gallery.slug}/download?type=all`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 rounded-xl text-xs flex-1 sm:flex-none justify-center")}
              download
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download ZIP</span>
            </a>
          )}
          <button
            onClick={handleCopyLink}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 rounded-xl text-xs flex-1 sm:flex-none justify-center")}
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? "Copied" : "Copy Link"}</span>
          </button>
          <Link
            href={shareUrl}
            target="_blank"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5 rounded-xl shadow-xs text-xs flex-1 sm:flex-none justify-center")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Client View</span>
          </Link>
        </div>
      </div>

      {/* ── Atmospheric Hero Header Card ── */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border/80 p-5 md:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Client Collection
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                Created {formatDistanceToNow(new Date(gallery.createdAt), { addSuffix: true })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-foreground font-oswald uppercase break-words">
              {gallery.name}
            </h1>

            {/* Live Status Chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {isExpired ? (
                <Badge variant="destructive" className="text-xs font-semibold px-2.5 py-0.5">
                  Expired on {new Date(gallery.expiresAt!).toLocaleDateString()}
                </Badge>
              ) : (
                <span className={cn(
                  "inline-flex items-center gap-1.5 border text-xs font-medium px-2.5 py-0.5 rounded-full",
                  gallery.stage === "delivered"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : gallery.stage === "both"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                )}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    gallery.stage === "delivered" ? "bg-amber-500" : gallery.stage === "both" ? "bg-purple-500" : "bg-emerald-500"
                  )} />
                  {gallery.stage === "delivered"
                    ? "Final Delivery Published ✨"
                    : gallery.stage === "both"
                    ? "Proofing & Delivery Active 🌟✨"
                    : "Active Proofing Phase 🌟"}
                </span>
              )}

              {gallery.maxSelections && (
                <Badge variant="outline" className="text-xs gap-1 font-mono">
                  Quota: Max {gallery.maxSelections} Photos
                </Badge>
              )}

              {isProtected ? (
                <Badge variant="outline" className="text-xs gap-1">
                  <Lock className="h-3 w-3" /> Password Protected
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Public Link
                </Badge>
              )}

              <Badge variant="secondary" className="text-xs capitalize">
                <Download className="h-3 w-3 mr-1" />
                {gallery.downloadMode === "full"
                  ? "Full Res Downloads"
                  : gallery.downloadMode === "lowres"
                  ? "Watermarked Downloads"
                  : "View Only (No Downloads)"}
              </Badge>

              {gallery.expiresAt && !isExpired && (
                <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Expires {new Date(gallery.expiresAt).toLocaleDateString()}
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Stats Block */}
          <div className="grid grid-cols-4 sm:flex items-center gap-2 sm:gap-4 bg-muted/40 p-3 sm:p-4 rounded-xl border border-border/50 shrink-0">
            <div className="text-center px-1 sm:px-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                Proof Set
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums font-oswald">
                {initialPhotos.filter(p => (p.section ?? "proofing") === "proofing").length}
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border/60" />
            <div className="text-center px-1 sm:px-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-500 block">
                Final Set
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums font-oswald">
                {initialPhotos.filter(p => p.section === "final").length}
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border/60" />
            <div className="text-center px-1 sm:px-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                Size
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums font-oswald">
                {totalSizeMB} <span className="text-xs font-normal text-muted-foreground font-sans">MB</span>
              </span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border/60" />
            <div className="text-center px-1 sm:px-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-500 block flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" /> Selections
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums font-oswald">
                {initialSelections.length}
              </span>
            </div>
          </div>
        </div>

        {/* Share URL Bar */}
        <div className="mt-6 pt-5 border-t border-border/50 flex flex-col sm:flex-row sm:items-center gap-2 bg-background/60 rounded-xl p-2.5 border border-border/40">
          <span className="text-xs text-muted-foreground px-2 font-mono truncate flex-1 select-all">
            {shareUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? "Link Copied" : "Copy Client Link"}</span>
          </button>
        </div>
      </div>

      {/* ── Studio Tabs Bar ── */}
      <div className="flex items-center gap-1 border-b border-border/80 pb-px overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("photos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer",
            activeTab === "photos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Images className="h-4 w-4" />
          <span>Photos & Uploads</span>
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md font-mono text-foreground">
            {initialPhotos.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("selections")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer",
            activeTab === "selections"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span>Client Selections</span>
          {initialSelections.length > 0 && (
            <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-semibold font-mono">
              {initialSelections.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer",
            activeTab === "settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* ── Tab Content Area ── */}
      {activeTab === "photos" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <GalleryEditor gallery={gallery} photos={initialPhotos} />
        </div>
      )}

      {activeTab === "selections" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {initialSelections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border-2 border-dashed border-border bg-card/40 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-amber-500/60" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No client selections yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                When your client favorites photos and clicks &ldquo;Submit Selection&rdquo; in the gallery proofing view, their chosen photos and timestamps will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Client Submission Sessions</h2>
                  <p className="text-xs text-muted-foreground">
                    Review submitted proofing selections and copy photo filenames for quick filtering in Lightroom or Capture One.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {initialSelections.map((selection, idx) => {
                  const photoCount = selection.selectionPhotos.length
                  const isCopied = copiedFilenamesId === selection.id

                  return (
                    <div
                      key={selection.id}
                      className="rounded-2xl bg-card border border-border/80 p-5 shadow-xs space-y-4"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                            #{initialSelections.length - idx}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">
                                Submission: {photoCount} photo{photoCount !== 1 ? "s" : ""} selected
                              </h4>
                              <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Submitted
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(selection.submittedAt).toLocaleString("en-GB", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Lightroom Filename Copy Button */}
                        <button
                          onClick={() => handleCopyLightroomFilenames(selection)}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "gap-1.5 rounded-xl shrink-0 font-medium",
                            isCopied && "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                          <span>{isCopied ? "Filenames Copied!" : "Copy Lightroom Filenames"}</span>
                        </button>
                      </div>

                      {/* Photo Thumbnail Grid */}
                      {photoCount > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 pt-1">
                          {selection.selectionPhotos.map((sp) => {
                            const p = sp.photo
                            if (!p) return null
                            return (
                              <div
                                key={sp.photoId}
                                className="group relative aspect-square rounded-lg bg-muted overflow-hidden border border-border/40"
                              >
                                {p.thumbKey && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`/api/s3/${p.thumbKey}`}
                                    alt={p.filename}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-center">
                                  <span className="text-[10px] text-white font-mono truncate max-w-full">
                                    {p.filename}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No specific photos recorded.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="max-w-2xl space-y-6 animate-in fade-in-50 duration-200">
          <div className="rounded-2xl bg-card border border-border/80 p-6 shadow-xs">
            <h3 className="text-base font-bold text-foreground mb-4">Collection Details & Permissions</h3>
            <form onSubmit={handleSettingsSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Collection Name
                </label>
                <input
                  name="name"
                  defaultValue={gallery.name}
                  required
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Collection Workflow Phase
                </label>
                <select
                  name="stage"
                  defaultValue={gallery.stage ?? "proofing"}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                >
                  <option value="proofing">🌟 Stage 1: Proofing & Selection (Clients star & request edits)</option>
                  <option value="delivered">✨ Stage 2: Final Delivery (Clients view retouched masters, use lightbox tools, download)</option>
                  <option value="both">🌟✨ Both Active (Client can switch between Proofing and Final Delivery)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Controls what the client sees when opening the gallery.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Client Selection Quota / Limit</span>
                  <span className="text-[11px] text-primary lowercase font-normal">Live countdown shown to client</span>
                </label>
                <div className="space-y-2">
                  <input
                    id="maxSelectionsInput"
                    name="maxSelections"
                    type="number"
                    defaultValue={gallery.maxSelections ?? ""}
                    placeholder="e.g. 25 (number of included retouched photos)"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono mr-1">Presets:</span>
                    {[10, 20, 30, 40, 50, 75, 100].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("maxSelectionsInput") as HTMLInputElement
                          if (input) input.value = String(num)
                        }}
                        className="px-2 py-0.5 text-xs font-mono rounded-md border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-colors cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("maxSelectionsInput") as HTMLInputElement
                        if (input) input.value = ""
                      }}
                      className="px-2 py-0.5 text-xs font-mono rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Clear (No Limit)
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clients will see a real-time countdown widget as they star images (e.g. &quot;15 of 25 Selected • 10 Remaining&quot;).
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Client Download Policy
                </label>
                <select
                  name="downloadMode"
                  defaultValue={gallery.downloadMode}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                >
                  <option value="none">No downloads (Proofing & view only)</option>
                  <option value="lowres">Low-resolution with studio watermark</option>
                  <option value="full">Full resolution original files</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Controls whether clients can download single photos or cropped edits from the lightbox.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Passcode Protection (Optional)
                </label>
                <input
                  name="password"
                  type="text"
                  placeholder={gallery.passwordHash ? "Password currently set (enter new password to change)" : "Leave empty for public link"}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Expiration Date (Optional)
                </label>
                <input
                  name="expiresAt"
                  type="date"
                  defaultValue={expiresAtValue}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className={cn(buttonVariants({ size: "default" }), "rounded-xl font-medium")}
                >
                  {isSavingSettings ? "Saving Changes…" : "Save Changes"}
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
              Permanently delete this collection, all {initialPhotos.length} hosted photos, and client proofing submissions. This action cannot be undone.
            </p>
            <form
              action={async () => {
                if (confirm(`Permanently delete "${gallery.name}"?`)) {
                  await deleteGallery(gallery.id)
                }
              }}
            >
              <button
                type="submit"
                className={cn(buttonVariants({ variant: "destructive", size: "sm" }), "rounded-xl mt-2")}
              >
                Delete Collection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
