"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Lock,
  Calendar,
  Download,
  Eye,
  Sparkles,
  Shield,
  Images,
  Check,
  Zap,
} from "lucide-react"
import { createGallery } from "@/app/actions/galleries"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function NewGalleryForm() {
  const [name, setName] = useState("")
  const [downloadMode, setDownloadMode] = useState<"none" | "lowres" | "full">("none")
  const [hasPassword, setHasPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Back Link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Collections</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Left Column: Form Setup ── */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              New Collection
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-wide text-foreground mt-1 font-oswald uppercase">
              Create Client Gallery
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure collection name, client download permissions, and optional security passcodes.
            </p>
          </div>

          <form
            action={async (formData: FormData) => {
              setIsSubmitting(true)
              await createGallery(formData)
            }}
            className="space-y-6 rounded-2xl bg-card border border-border/80 p-6 shadow-xs"
          >
            {/* Gallery Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Collection Name <span className="text-primary">*</span>
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="e.g. Wedding — Sarah & Michael"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
              />
            </div>

            {/* Download Permissions Cards */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Client Download Permissions
              </label>
              <input type="hidden" name="downloadMode" value={downloadMode} />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: "none",
                      title: "View & Proof Only",
                      desc: "Clients can favorite and proof without file downloads",
                      icon: Eye,
                    },
                    {
                      id: "lowres",
                      title: "Watermarked",
                      desc: "Clients can download web-ready watermarked files",
                      icon: Sparkles,
                    },
                    {
                      id: "full",
                      title: "Full Resolution",
                      desc: "Clients can download original high-res photos",
                      icon: Download,
                    },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon
                  const isSelected = downloadMode === opt.id

                  return (
                    <div
                      key={opt.id}
                      onClick={() => setDownloadMode(opt.id)}
                      className={cn(
                        "p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                          : "border-border bg-background hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{opt.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Password Protection */}
            <div className="space-y-3 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-foreground block">
                    Passcode Protection
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Require clients to enter a passcode to view the gallery.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={hasPassword}
                  onChange={(e) => {
                    setHasPassword(e.target.checked)
                    if (!e.target.checked) setPassword("")
                  }}
                  className="h-4 w-4 rounded accent-primary cursor-pointer"
                />
              </div>

              {hasPassword && (
                <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      name="password"
                      type="text"
                      placeholder="Enter gallery password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Expiration Date */}
            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <label htmlFor="expiresAt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Link Expiration (Optional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave blank if this gallery should never expire.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full rounded-xl shadow-md font-semibold gap-2 transition-all"
                )}
              >
                <Zap className="h-4 w-4" />
                <span>{isSubmitting ? "Creating Collection…" : "Create & Open Studio"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Real-time Live Preview Card ── */}
        <div className="lg:col-span-5 space-y-3 sticky top-24">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span>Live Client Preview</span>
          </div>

          <div className="rounded-2xl bg-card border border-border/80 overflow-hidden shadow-lg space-y-0">
            {/* Preview Cover Banner */}
            <div className="relative aspect-[16/10] bg-neutral-900 flex flex-col justify-between p-4 text-white overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />

              {/* Status badges */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live Proofing
                </span>

                {hasPassword && password && (
                  <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    <Lock className="h-2.5 w-2.5" /> Passcode Required
                  </span>
                )}
              </div>

              {/* Center dummy photo stack */}
              <div className="relative z-10 text-center py-4">
                <Images className="h-10 w-10 text-white/30 mx-auto mb-1 stroke-[1.2]" />
                <span className="text-[11px] text-white/50 tracking-wider uppercase font-mono">
                  Photos uploaded next
                </span>
              </div>

              {/* Bottom Title */}
              <div className="relative z-10 space-y-0.5">
                <h3 className="text-xl font-bold font-oswald tracking-[0.03em] uppercase truncate">
                  {name.trim() || "Untitled Collection"}
                </h3>
                <p className="text-[10px] text-white/60">
                  {downloadMode === "full"
                    ? "Full resolution downloads enabled"
                    : downloadMode === "lowres"
                    ? "Watermarked downloads enabled"
                    : "Proofing & selection view only"}
                </p>
              </div>
            </div>

            {/* Preview Details Strip */}
            <div className="p-4 space-y-2.5 text-xs bg-card">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Security</span>
                <span className="font-medium text-foreground">
                  {hasPassword && password ? "Password Protected" : "Public Link"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Downloads</span>
                <span className="font-medium text-foreground capitalize">
                  {downloadMode === "full" ? "Full Original" : downloadMode === "lowres" ? "Watermarked" : "None"}
                </span>
              </div>
              {expiresAt && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Expires</span>
                  <span className="font-medium text-foreground">
                    {new Date(expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
