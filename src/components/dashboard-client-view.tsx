"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Plus,
  Images,
  Search,
  Grid,
  List,
  Lock,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  HardDrive,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Trash2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteGallery } from "@/app/actions/galleries"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export type DashboardGallery = {
  id: string
  name: string
  slug: string
  passwordHash: string | null
  expiresAt: Date | string | null
  downloadMode: "none" | "lowres" | "full"
  createdAt: Date | string
  photosCount: number
  coverThumbKey: string | null
  previewThumbs: string[]
  selectionsCount: number
}

interface DashboardClientViewProps {
  userName: string
  galleries: DashboardGallery[]
  storageUsedBytes: number
  storageLimitBytes: number
  baseUrl: string
}

export function DashboardClientView({
  userName,
  galleries,
  storageUsedBytes,
  storageLimitBytes,
  baseUrl,
}: DashboardClientViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "protected" | "expired" | "selections">("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Metrics
  const totalPhotos = useMemo(() => galleries.reduce((acc, g) => acc + g.photosCount, 0), [galleries])
  const totalSelections = useMemo(() => galleries.reduce((acc, g) => acc + g.selectionsCount, 0), [galleries])
  const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(1)
  const storageLimitGB = (storageLimitBytes / (1024 * 1024 * 1024)).toFixed(0)
  const storagePct = Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100))

  // Filtered Galleries
  const filteredGalleries = useMemo(() => {
    return galleries.filter((g) => {
      const matchesSearch =
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.slug.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      const isExpired = g.expiresAt ? new Date(g.expiresAt) < new Date() : false
      const isProtected = Boolean(g.passwordHash)
      const hasSelections = g.selectionsCount > 0

      if (statusFilter === "active") return !isExpired
      if (statusFilter === "expired") return isExpired
      if (statusFilter === "protected") return isProtected
      if (statusFilter === "selections") return hasSelections
      return true
    })
  }, [galleries, searchQuery, statusFilter])

  async function handleCopy(gallery: DashboardGallery, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url = `${baseUrl}/g/${gallery.slug}`
    await navigator.clipboard.writeText(url)
    setCopiedId(gallery.id)
    toast.success("Proofing link copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleDelete(galleryId: string, galleryName: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Are you sure you want to permanently delete "${galleryName}" and all its photos?`)) {
      return
    }
    setDeletingId(galleryId)
    try {
      await deleteGallery(galleryId)
      toast.success("Gallery deleted successfully")
    } catch {
      toast.error("Failed to delete gallery")
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* ── Studio Header & KPI Strip ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card/90 to-card/50 border border-border/70 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Photographer Studio</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-foreground font-oswald uppercase">
              Welcome back, {userName || "Photographer"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-lg">
              Manage client proofing collections, track photo selections, and share high-resolution galleries.
            </p>
          </div>

          <Link
            href="/dashboard/galleries/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 shadow-md hover:shadow-lg transition-all rounded-xl font-medium"
            )}
          >
            <Plus className="h-4 w-4" />
            <span>New Collection</span>
          </Link>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mt-8 pt-6 border-t border-border/50">
          <div className="bg-background/50 rounded-xl p-3.5 border border-border/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Images className="h-3.5 w-3.5 text-primary" /> Collections
            </span>
            <p className="text-3xl font-bold text-foreground mt-1 tabular-nums font-oswald">{galleries.length}</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3.5 border border-border/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" /> Photos Hosted
            </span>
            <p className="text-3xl font-bold text-foreground mt-1 tabular-nums font-oswald">{totalPhotos}</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3.5 border border-border/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Client Proofs
            </span>
            <p className="text-3xl font-bold text-foreground mt-1 tabular-nums font-oswald">{totalSelections}</p>
          </div>

          <div className="bg-background/50 rounded-xl p-3.5 border border-border/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-primary" /> Storage
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground font-mono">{storagePct}%</span>
            </span>
            <p className="text-sm font-bold text-foreground mt-1 truncate font-oswald tracking-wide">
              {storageUsedMB} <span className="text-xs font-normal text-muted-foreground font-sans">MB / {storageLimitGB} GB</span>
            </p>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Control Dock ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search collections by title or slug…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border/80 rounded-xl text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filters & View Toggle */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center bg-card border border-border/80 rounded-xl p-1 shadow-xs">
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "protected", label: "Protected" },
                { id: "selections", label: "Proofs" },
                { id: "expired", label: "Expired" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap",
                  statusFilter === filter.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-card border border-border/80 rounded-xl p-1 shadow-xs shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid View"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Gallery List / Grid ── */}
      {filteredGalleries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 rounded-2xl border-2 border-dashed border-border/80 bg-card/40 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-4">
            <Images className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No collections found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "Create your first photo gallery to start delivering proofing collections to clients."}
          </p>
          <Link
            href="/dashboard/galleries/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-5 gap-1.5 rounded-xl")}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Collection
          </Link>
        </div>
      ) : viewMode === "grid" ? (
        /* ── EDITORIAL GRID VIEW ── */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGalleries.map((gallery) => {
            const isExpired = gallery.expiresAt ? new Date(gallery.expiresAt) < new Date() : false
            const isProtected = Boolean(gallery.passwordHash)
            const isDeleting = deletingId === gallery.id

            return (
              <div
                key={gallery.id}
                className={cn(
                  "group relative flex flex-col rounded-2xl bg-card border border-border/70 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5",
                  isDeleting && "opacity-50 pointer-events-none"
                )}
              >
                {/* ── Cover Area with Layered Stack Peek ── */}
                <Link href={`/dashboard/galleries/${gallery.id}`} className="block relative aspect-[16/10] bg-muted/40 overflow-hidden">
                  {gallery.coverThumbKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/s3/${gallery.coverThumbKey}`}
                      alt={gallery.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 text-muted-foreground/40">
                      <Images className="h-10 w-10 stroke-[1.2] mb-1" />
                      <span className="text-xs font-medium">Empty collection</span>
                    </div>
                  )}

                  {/* Gradient Vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Top Status Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isExpired ? (
                        <Badge variant="destructive" className="text-[10px] font-semibold px-2 py-0.5 shadow-sm">
                          Expired
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/15 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Live
                        </span>
                      )}

                      {isProtected && (
                        <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/15 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <Lock className="h-2.5 w-2.5" /> Passcode
                        </span>
                      )}
                    </div>

                    <span className="bg-black/60 backdrop-blur-md border border-white/15 text-white/90 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {gallery.photosCount} photo{gallery.photosCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Bottom Title & Time on Image */}
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-white pointer-events-none">
                    <h3 className="text-lg font-bold truncate drop-shadow-sm font-oswald tracking-[0.03em] uppercase">
                      {gallery.name}
                    </h3>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Created {formatDistanceToNow(new Date(gallery.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </Link>

                {/* ── Multi-photo thumbnail peek row (if > 1 photo) ── */}
                {gallery.previewThumbs.length > 1 && (
                  <div className="grid grid-cols-4 gap-1 p-2 bg-muted/20 border-b border-border/40">
                    {gallery.previewThumbs.slice(0, 4).map((thumb, idx) => (
                      <div key={idx} className="aspect-square rounded-md overflow-hidden bg-muted relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/s3/${thumb}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Card Footer & Quick Action Dock ── */}
                <div className="p-3.5 flex items-center justify-between gap-2 bg-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize font-medium text-foreground text-[11px] bg-muted px-2 py-0.5 rounded-md">
                      {gallery.downloadMode === "full"
                        ? "Full Downloads"
                        : gallery.downloadMode === "lowres"
                        ? "Watermarked"
                        : "View Only"}
                    </span>
                    {gallery.selectionsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                        <Sparkles className="h-3 w-3" />
                        {gallery.selectionsCount} proof{gallery.selectionsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Quick Action Icons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopy(gallery, e)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy proofing link"
                    >
                      {copiedId === gallery.id ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <Link
                      href={`${baseUrl}/g/${gallery.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Open client preview"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/dashboard/galleries/${gallery.id}/settings`}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Gallery settings"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={(e) => handleDelete(gallery.id, gallery.name, e)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete gallery"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── COMPACT LIST VIEW ── */
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs divide-y divide-border/60">
          {filteredGalleries.map((gallery) => {
            const isExpired = gallery.expiresAt ? new Date(gallery.expiresAt) < new Date() : false
            const isProtected = Boolean(gallery.passwordHash)

            return (
              <div
                key={gallery.id}
                className="group flex items-center justify-between p-3.5 sm:px-5 hover:bg-muted/30 transition-colors gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0 relative border border-border/50">
                    {gallery.coverThumbKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/s3/${gallery.coverThumbKey}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Images className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/galleries/${gallery.id}`}
                      className="text-base font-bold text-foreground hover:text-primary transition-colors truncate block font-oswald tracking-[0.02em] uppercase"
                    >
                      {gallery.name}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{gallery.photosCount} photos</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(gallery.createdAt), { addSuffix: true })}</span>
                      {gallery.selectionsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-500 font-medium">
                            {gallery.selectionsCount} selection{gallery.selectionsCount !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5">
                    {isExpired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
                    {isProtected && <Badge variant="outline" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" /> Protected</Badge>}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopy(gallery, e)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy proofing link"
                    >
                      {copiedId === gallery.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <Link
                      href={`${baseUrl}/g/${gallery.slug}`}
                      target="_blank"
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Client preview"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/dashboard/galleries/${gallery.id}`}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
