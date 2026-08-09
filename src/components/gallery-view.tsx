"use client"

import { useState } from "react"
import { Star, MessageSquare, Download, ChevronLeft, ChevronRight, X, SlidersHorizontal, Grid3X3, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, stars, comments } from "@/db/schema"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>
type Star = InferSelectModel<typeof stars>
type Comment = InferSelectModel<typeof comments>

function getClientId(): string {
  let id = localStorage.getItem("frameshare_client_id")
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("frameshare_client_id", id) }
  return id
}

function imgUrl(key: string | null | undefined) {
  if (!key) return null
  return `/api/s3/${key}`
}

export function GalleryView({
  gallery,
  photos,
  initialStars,
  initialComments,
}: {
  gallery: Gallery
  photos: Photo[]
  initialStars: Star[]
  initialComments: Comment[]
}) {
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(initialStars.map((s) => s.photoId))
  )
  const [commentMap, setCommentMap] = useState<Record<string, Comment[]>>(
    () => initialComments.reduce<Record<string, Comment[]>>((acc, c) => {
      acc[c.photoId] = [...(acc[c.photoId] ?? []), c]
      return acc
    }, {})
  )
  const [view, setView] = useState<"grid" | "slideshow">("grid")
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [commentName, setCommentName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const slug = gallery.slug
  const accentColor = gallery.accentColor ?? "#000000"

  async function toggleStar(photoId: string) {
    const clientId = getClientId()
    const isStarred = starredIds.has(photoId)
    setStarredIds((s) => { const n = new Set(s); isStarred ? n.delete(photoId) : n.add(photoId); return n })
    await fetch(`/api/galleries/${slug}/stars`, {
      method: isStarred ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, clientId }),
    })
  }

  async function submitComment(photoId: string) {
    if (!commentBody.trim()) return
    const res = await fetch(`/api/galleries/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, body: commentBody, authorName: commentName }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      setCommentMap((m) => ({ ...m, [photoId]: [...(m[photoId] ?? []), comment] }))
      setCommentBody("")
      setCommentPhotoId(null)
    }
  }

  async function submitSelection() {
    setSubmitting(true)
    const clientId = getClientId()
    await fetch(`/api/galleries/${slug}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  const activePhoto = activeIdx !== null ? photos[activeIdx] : null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-card z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gallery.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" className="h-7 w-auto object-contain" />
            )}
            <span className="font-medium text-[15px]">{gallery.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              onClick={() => setView(view === "grid" ? "slideshow" : "grid")}
              title={view === "grid" ? "Slideshow" : "Grid"}
            >
              {view === "grid" ? <SlidersHorizontal className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </Button>
            {starredIds.size > 0 && !submitted && (
              <Button size="sm" onClick={submitSelection} disabled={submitting}
                style={{ backgroundColor: accentColor, color: "#fff" }}>
                {submitting ? "Submitting…" : `Submit ${starredIds.size} selected`}
              </Button>
            )}
            {submitted && (
              <Badge variant="outline" className="text-primary border-primary/40">
                Selection submitted ✓
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Grid view */}
      {view === "grid" && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo, idx) => {
              const starred = starredIds.has(photo.id)
              const commentCount = (commentMap[photo.id] ?? []).length
              return (
                <div
                  key={photo.id}
                  className={`group relative aspect-square bg-muted rounded-md overflow-hidden cursor-pointer transition-all duration-150 ${
                    starred ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                  onClick={() => { setActiveIdx(idx); setView("slideshow") }}
                >
                  {photo.thumbKey && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl(photo.thumbKey)!} alt={photo.filename}
                      className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(photo.id) }}
                      className="p-1.5 rounded-full bg-white/90 shadow"
                    >
                      <Star className={`h-3.5 w-3.5 ${starred ? "fill-yellow-400 text-yellow-400" : "text-neutral-600"}`} />
                    </button>
                    {commentCount > 0 && (
                      <Badge className="text-xs bg-white/90 text-neutral-700 shadow">{commentCount}</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Slideshow view */}
      {view === "slideshow" && activePhoto && (
        <div className="fixed inset-0 bg-black z-20 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button onClick={() => setView("grid")} className="flex items-center gap-1 text-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" /> Close
            </button>
            <span className="text-sm opacity-70">{(activeIdx ?? 0) + 1} / {photos.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleStar(activePhoto.id)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20">
                <Star className={`h-4 w-4 ${starredIds.has(activePhoto.id) ? "fill-yellow-400 text-yellow-400" : "text-white"}`} />
              </button>
              <button
                onClick={() => setCommentPhotoId(commentPhotoId === activePhoto.id ? null : activePhoto.id)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 relative"
              >
                <MessageSquare className="h-4 w-4 text-white" />
                {(commentMap[activePhoto.id]?.length ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                    {commentMap[activePhoto.id].length}
                  </span>
                )}
              </button>
              {gallery.downloadMode !== "none" && (
                <a
                  href={imgUrl(gallery.downloadMode === "lowres" ? activePhoto.watermarkedKey : activePhoto.originalKey) ?? "#"}
                  download={activePhoto.filename}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Download className="h-4 w-4 text-white" />
                </a>
              )}
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!}
              alt={activePhoto.filename}
              className="max-w-full max-h-full object-contain" />
            <button onClick={() => setActiveIdx((i) => Math.max(0, (i ?? 0) - 1))}
              disabled={(activeIdx ?? 0) === 0}
              className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={() => setActiveIdx((i) => Math.min(photos.length - 1, (i ?? 0) + 1))}
              disabled={(activeIdx ?? 0) === photos.length - 1}
              className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Comment panel */}
          {commentPhotoId === activePhoto.id && (
            <div className="bg-neutral-900 text-white px-4 py-3 max-h-64 overflow-y-auto space-y-3">
              {(commentMap[activePhoto.id] ?? []).map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-medium opacity-70">{c.authorName ?? "Anonymous"}</span>
                  <p className="opacity-90">{c.body}</p>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input value={commentName} onChange={(e) => setCommentName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="bg-white/10 rounded px-2 py-1.5 text-sm flex-1 outline-none placeholder:opacity-50 min-w-0 max-w-[140px]" />
                <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment…"
                  className="bg-white/10 rounded px-2 py-1.5 text-sm flex-1 outline-none placeholder:opacity-50"
                  onKeyDown={(e) => e.key === "Enter" && submitComment(activePhoto.id)} />
                <button onClick={() => submitComment(activePhoto.id)}
                  className="p-1.5 rounded bg-white/20 hover:bg-white/30 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
