"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Star, MessageSquare, Download, ChevronLeft, ChevronRight, X, Send, Play, Pause, SlidersHorizontal } from "lucide-react"
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

const FILTERS: Record<string, string> = {
  Normal:  "",
  Warm:    "sepia(0.22) saturate(1.4) brightness(1.05)",
  Cool:    "saturate(0.75) contrast(1.05) brightness(1.08)",
  "B&W":   "grayscale(1) contrast(1.1)",
  Vivid:   "saturate(1.7) contrast(1.12)",
  Fade:    "brightness(1.15) contrast(0.78) saturate(0.65)",
  Vintage: "sepia(0.5) contrast(1.1) brightness(0.90) saturate(1.15)",
}

const SLIDESHOW_INTERVAL = 4000

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
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(initialStars.map((s) => s.photoId))
  )
  const [commentMap, setCommentMap] = useState<Record<string, Comment[]>>(
    () => initialComments.reduce<Record<string, Comment[]>>((acc, c) => {
      acc[c.photoId] = [...(acc[c.photoId] ?? []), c]
      return acc
    }, {})
  )
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [navDir, setNavDir] = useState<"right" | "left">("right")
  const [isSlideshow, setIsSlideshow] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState("Normal")
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [commentName, setCommentName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slug = gallery.slug
  const accentColor = gallery.accentColor ?? "#000000"
  const filterCss = FILTERS[activeFilter] ?? ""

  // Scroll-triggered reveal
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

  // Slideshow auto-advance
  const goNext = useCallback(() => {
    setNavDir("right")
    setActiveIdx((i) => {
      if (i === null || i >= photos.length - 1) { setIsSlideshow(false); return i }
      return i + 1
    })
  }, [photos.length])

  const goPrev = useCallback(() => {
    setNavDir("left")
    setActiveIdx((i) => Math.max(0, (i ?? 0) - 1))
  }, [])

  useEffect(() => {
    if (!isSlideshow || activeIdx === null) return
    timerRef.current = setTimeout(goNext, SLIDESHOW_INTERVAL)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isSlideshow, activeIdx, goNext])

  // Keyboard nav
  useEffect(() => {
    if (activeIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") { setIsSlideshow(false); goNext() }
      else if (e.key === "ArrowLeft") { setIsSlideshow(false); goPrev() }
      else if (e.key === "Escape") { setIsSlideshow(false); setActiveIdx(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeIdx, goNext, goPrev])

  function openLightbox(idx: number, slideshow = false) {
    setNavDir("right")
    setActiveIdx(idx)
    setIsSlideshow(slideshow)
  }

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
            <Button variant="outline" size="sm" onClick={() => openLightbox(0, true)}
              className="gap-1.5">
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
              {/* Filter toggle */}
              <button onClick={() => setShowFilters(f => !f)}
                className={`p-2 rounded-full transition-colors ${showFilters ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                title="Filters">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </button>
              {/* Slideshow play/pause */}
              <button onClick={() => setIsSlideshow(s => !s)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                title={isSlideshow ? "Pause slideshow" : "Play slideshow"}>
                {isSlideshow
                  ? <Pause className="h-4 w-4 text-white" />
                  : <Play  className="h-4 w-4 text-white" />}
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
              <button onClick={() => { setIsSlideshow(false); setActiveIdx(null) }}
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
            {/* Slide wrapper — handles slide direction */}
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

            {/* Nav arrows */}
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

            {/* Slideshow progress bar */}
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
                  onKeyDown={(e) => e.key === "Enter" && submitComment(activePhoto.id)} />
                <button onClick={() => submitComment(activePhoto.id)}
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
