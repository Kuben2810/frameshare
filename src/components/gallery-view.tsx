"use client"

import { useState, useEffect, useRef } from "react"
import { Star, MessageSquare, Download, ChevronLeft, ChevronRight, X, Send, Play, Pause, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, stars, comments } from "@/db/schema"
import { FILTERS } from "@/lib/gallery-filters"
import { useGalleryInteraction } from "@/lib/hooks/use-gallery-interaction"
import { useSlideshow } from "@/lib/hooks/use-slideshow"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>
type Star = InferSelectModel<typeof stars>
type Comment = InferSelectModel<typeof comments>

function imgUrl(key: string | null | undefined) {
  if (!key) return null
  return `/api/s3/${key}`
}

function handleTilt(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const { left, top, width, height } = el.getBoundingClientRect()
  const x = (e.clientX - left) / width - 0.5
  const y = (e.clientY - top) / height - 0.5
  el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.03)`
  el.style.transition = "transform 0.05s ease-out"
}
function resetTilt(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.transform = ""
  e.currentTarget.style.transition = "transform 0.35s ease"
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
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState("Normal")
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [commentName, setCommentName] = useState("")
  const gridRef = useRef<HTMLDivElement>(null)

  const { starredIds, commentMap, submitting, submitted, toggleStar, submitComment, submitSelection } =
    useGalleryInteraction(gallery.slug, initialStars, initialComments)

  const { activeIdx, navDir, isSlideshow, setIsSlideshow, openLightbox, closeLightbox, goNext, goPrev } =
    useSlideshow(photos.length)

  const accentColor = gallery.accentColor ?? "#000000"
  const filterCss = FILTERS[activeFilter] ?? ""
  const activePhoto = activeIdx !== null ? photos[activeIdx] : null

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cards = grid.querySelectorAll<HTMLElement>(".photo-card")
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            setTimeout(() => el.classList.add("revealed"), parseInt(el.dataset.delay ?? "0"))
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.08 }
    )
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [photos])

  async function handleCommentSubmit(photoId: string) {
    const ok = await submitComment(photoId, commentBody, commentName)
    if (ok) { setCommentBody(""); setCommentPhotoId(null) }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-card/90 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gallery.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" className="h-7 w-auto object-contain" />
            )}
            <span className="font-semibold text-base">{gallery.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => openLightbox(0, true)} className="gap-1.5">
              <Play className="h-3.5 w-3.5" /> Slideshow
            </Button>
            {starredIds.size > 0 && !submitted && (
              <Button size="sm" onClick={submitSelection} disabled={submitting}
                style={{ backgroundColor: accentColor, color: "#fff" }}>
                {submitting ? "Submitting…" : `Submit ${starredIds.size} selected`}
              </Button>
            )}
            {submitted && (
              <Badge variant="outline" className="text-primary border-primary/40">Selection submitted ✓</Badge>
            )}
          </div>
        </div>
      </header>

      {/* Masonry grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div ref={gridRef} className="masonry-grid">
          {photos.map((photo, idx) => {
            const starred = starredIds.has(photo.id)
            const commentCount = (commentMap[photo.id] ?? []).length
            return (
              <div
                key={photo.id}
                data-delay={Math.min(idx * 50, 400)}
                className={`photo-card group relative overflow-hidden rounded-md bg-muted cursor-pointer
                  ${starred ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                onClick={() => openLightbox(idx)}
                onMouseMove={handleTilt}
                onMouseLeave={resetTilt}
              >
                {photo.thumbKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(photo.thumbKey)!} alt={photo.filename} loading="lazy"
                    className="w-full h-auto block" />
                ) : (
                  <div className="aspect-square" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between
                  px-2 py-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                  <button onClick={(e) => { e.stopPropagation(); toggleStar(photo.id) }}
                    className="p-1.5 rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 active:scale-95">
                    <Star className={`h-3.5 w-3.5 ${starred ? "fill-yellow-400 text-yellow-400" : "text-neutral-600"}`} />
                  </button>
                  {commentCount > 0 && (
                    <Badge className="text-xs bg-white/90 text-neutral-700 shadow-sm">{commentCount}</Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lightbox */}
      {activePhoto && (
        <div className="fixed inset-0 bg-black z-20 flex flex-col lb-open">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm opacity-60">{(activeIdx ?? 0) + 1} / {photos.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters(f => !f)}
                className={`p-2 rounded-full transition-colors ${showFilters ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                title="Filters">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </button>
              <button onClick={() => setIsSlideshow(s => !s)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title={isSlideshow ? "Pause slideshow" : "Play slideshow"}>
                {isSlideshow ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
              </button>
              <button onClick={() => toggleStar(activePhoto.id)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Star className={`h-4 w-4 ${starredIds.has(activePhoto.id) ? "fill-yellow-400 text-yellow-400" : "text-white"}`} />
              </button>
              <button
                onClick={() => setCommentPhotoId(commentPhotoId === activePhoto.id ? null : activePhoto.id)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors relative">
                <MessageSquare className="h-4 w-4 text-white" />
                {(commentMap[activePhoto.id]?.length ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                    {commentMap[activePhoto.id].length}
                  </span>
                )}
              </button>
              {gallery.downloadMode !== "none" && (
                <a href={imgUrl(gallery.downloadMode === "lowres" ? activePhoto.watermarkedKey : activePhoto.originalKey) ?? "#"}
                  download={activePhoto.filename}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                  <Download className="h-4 w-4 text-white" />
                </a>
              )}
              <button onClick={closeLightbox}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Filter pills */}
          {showFilters && (
            <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none shrink-0 animate-in slide-in-from-top-2 duration-200">
              {Object.keys(FILTERS).map((name) => (
                <button key={name} onClick={() => setActiveFilter(name)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                    ${activeFilter === name
                      ? "bg-white text-black scale-105 shadow"
                      : "bg-white/15 text-white/80 hover:bg-white/25"}`}>
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Image area */}
          <div className="relative flex-1 min-h-0">
            <div key={`${activePhoto.id}-${navDir}`}
              className={`absolute inset-0 ${navDir === "right" ? "lb-slide-right" : "lb-slide-left"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!}
                alt={activePhoto.filename}
                style={{ filter: filterCss }}
                className={`absolute inset-0 w-full h-full object-contain transition-[filter] duration-300
                  ${isSlideshow ? ((activeIdx ?? 0) % 2 === 0 ? "kb-even" : "kb-odd") : ""}`}
              />
            </div>
            <button onClick={() => { setIsSlideshow(false); goPrev() }}
              disabled={(activeIdx ?? 0) === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 transition-all hover:scale-110 z-10">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button onClick={() => { setIsSlideshow(false); goNext() }}
              disabled={(activeIdx ?? 0) === photos.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/25 disabled:opacity-20 transition-all hover:scale-110 z-10">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
            {isSlideshow && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
                <div key={`bar-${activeIdx}`} className="h-full bg-white slideshow-bar" />
              </div>
            )}
          </div>

          {/* Comment panel */}
          {commentPhotoId === activePhoto.id && (
            <div className="bg-neutral-900 text-white px-4 py-3 max-h-56 overflow-y-auto space-y-3 shrink-0 animate-in slide-in-from-bottom-2 duration-200">
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
                  onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit(activePhoto.id)} />
                <button onClick={() => handleCommentSubmit(activePhoto.id)}
                  className="p-1.5 rounded bg-white/20 hover:bg-white/30 shrink-0 transition-colors">
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
