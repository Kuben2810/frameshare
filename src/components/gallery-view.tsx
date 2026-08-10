"use client"

import { useState, useEffect, useRef } from "react"
import { Star, MessageSquare, Download, ChevronLeft, ChevronRight, X, Send, Play, Pause, SlidersHorizontal, RotateCcw, Crop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, stars, comments } from "@/db/schema"
import { FILTERS } from "@/lib/gallery-filters"
import { useGalleryInteraction } from "@/lib/hooks/use-gallery-interaction"
import { useSlideshow } from "@/lib/hooks/use-slideshow"
import { LightboxCrop } from "@/components/lightbox-crop"

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
  const [adjustments, setAdjustments] = useState({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })
  const [cropMode, setCropMode] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
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
  const { brightness, contrast, saturation, sharpness } = adjustments
  const hasAdjustments = brightness !== 1 || contrast !== 1 || saturation !== 1 || sharpness !== 0
  const editCss = [
    sharpness > 0 && "url(#lb-sharpen)",
    brightness !== 1 && `brightness(${brightness})`,
    contrast  !== 1 && `contrast(${contrast})`,
    saturation !== 1 && `saturate(${saturation})`,
  ].filter(Boolean).join(" ")
  const appliedFilter = [editCss, filterCss].filter(Boolean).join(" ")
  const activePhoto = activeIdx !== null ? photos[activeIdx] : null

  useEffect(() => {
    if (activeIdx === null) { setAdjustments({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 }); setCropMode(false); setShowDownloadMenu(false) }
  }, [activeIdx])

  async function downloadWithEdits() {
    if (!activePhoto) return
    setShowDownloadMenu(false)
    const src = imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!
    const img = new Image()
    img.src = src
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")) })
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")!
    if (appliedFilter) ctx.filter = appliedFilter
    ctx.drawImage(img, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement("a"), { href: url, download: `edited_${activePhoto.filename}` })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }, "image/jpeg", 0.92)
  }

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
                title="Filters & adjustments">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </button>
              <button onClick={() => setCropMode(m => !m)}
                className={`p-2 rounded-full transition-colors ${cropMode ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                title="Crop">
                <Crop className="h-4 w-4 text-white" />
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
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(m => !m)}
                    className={`p-2 rounded-full transition-colors ${showDownloadMenu ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                    title="Download">
                    <Download className="h-4 w-4 text-white" />
                  </button>
                  {showDownloadMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-neutral-900 border border-white/10 rounded-lg overflow-hidden text-sm w-48 z-20 shadow-xl">
                        <button onClick={downloadWithEdits}
                          className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-colors">
                          Download with edits
                        </button>
                        <a
                          href={imgUrl(gallery.downloadMode === "lowres" ? activePhoto.watermarkedKey : activePhoto.originalKey) ?? "#"}
                          download={activePhoto.filename}
                          onClick={() => setShowDownloadMenu(false)}
                          className="block px-4 py-2.5 text-white hover:bg-white/10 transition-colors">
                          Download original
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button onClick={closeLightbox}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Filters + adjustments */}
          {showFilters && (
            <div className="px-4 pb-3 space-y-2 shrink-0 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
              <div className="flex items-center gap-4">
                {([
                  { key: "brightness" as const, label: "Brightness", min: 0.5, max: 2,   step: 0.05, def: 1 },
                  { key: "contrast"   as const, label: "Contrast",   min: 0.5, max: 2,   step: 0.05, def: 1 },
                  { key: "saturation" as const, label: "Saturation", min: 0,   max: 2,   step: 0.05, def: 1 },
                  { key: "sharpness"  as const, label: "Sharpness",  min: 0,   max: 1,   step: 0.05, def: 0 },
                ]).map(({ key, label, min, max, step }) => (
                  <label key={key} className="flex-1 flex flex-col gap-1 min-w-0">
                    <span className="text-white/50 text-[10px] uppercase tracking-wide">{label}</span>
                    <input type="range" min={min} max={max} step={step}
                      value={adjustments[key]}
                      onChange={(e) => setAdjustments((a) => ({ ...a, [key]: +e.target.value }))}
                      className="w-full accent-white" />
                  </label>
                ))}
                <button
                  onClick={() => setAdjustments({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })}
                  disabled={!hasAdjustments}
                  title="Reset adjustments"
                  className="shrink-0 p-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-20 transition-colors mt-3.5">
                  <RotateCcw className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* SVG sharpen filter (hidden; referenced by CSS filter url(#lb-sharpen)) */}
          {sharpness > 0 && (
            <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
              <defs>
                <filter id="lb-sharpen" colorInterpolationFilters="sRGB">
                  <feConvolveMatrix order="3" preserveAlpha="true"
                    kernelMatrix={`0 ${-sharpness} 0 ${-sharpness} ${1 + 4 * sharpness} ${-sharpness} 0 ${-sharpness} 0`} />
                </filter>
              </defs>
            </svg>
          )}

          {/* Image area */}
          <div className="relative flex-1 min-h-0">
            <div key={`${activePhoto.id}-${navDir}`}
              className={`absolute inset-0 ${navDir === "right" ? "lb-slide-right" : "lb-slide-left"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!}
                alt={activePhoto.filename}
                style={{ filter: appliedFilter }}
                className={`absolute inset-0 w-full h-full object-contain transition-[filter] duration-300
                  ${isSlideshow ? ((activeIdx ?? 0) % 2 === 0 ? "kb-even" : "kb-odd") : ""}`}
              />
            </div>
            {!cropMode && (
              <>
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
              </>
            )}
            {cropMode && (
              <LightboxCrop
                imageUrl={imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!}
                naturalWidth={activePhoto.width ?? 0}
                naturalHeight={activePhoto.height ?? 0}
                filename={activePhoto.filename}
                onClose={() => setCropMode(false)}
              />
            )}
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
