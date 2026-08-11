"use client"

import { useState, useEffect, useRef } from "react"
import { Star, MessageSquare, Download, X, Send, Play, Pause, SlidersHorizontal, RotateCcw, Crop } from "lucide-react"
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

const display = { fontFamily: "var(--font-oswald, 'Oswald', sans-serif)" }

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
  const [showTip, setShowTip] = useState(false)
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [commentName, setCommentName] = useState("")
  const gridRef = useRef<HTMLDivElement>(null)

  const { starredIds, commentMap, submitting, submitted, toggleStar, submitComment, submitSelection } =
    useGalleryInteraction(gallery.slug, initialStars, initialComments)

  const { activeIdx, navDir, isSlideshow, setIsSlideshow, openLightbox, closeLightbox, goNext, goPrev } =
    useSlideshow(photos.length)

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
    if (activeIdx === null) {
      setAdjustments({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })
      setCropMode(false); setShowDownloadMenu(false); setShowTip(false)
    } else if (!localStorage.getItem("lb-tip-dismissed")) {
      setShowTip(true)
    }
  }, [activeIdx])

  function dismissTip() {
    setShowTip(false)
    localStorage.setItem("lb-tip-dismissed", "1")
  }

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
    <div className="min-h-screen bg-black text-white">
      {/* Left sidebar — gallery name, bottom-to-top */}
      <aside className="fixed left-0 top-0 bottom-0 w-10 flex flex-col items-center justify-end pb-8 z-10 pointer-events-none">
        <span
          style={{ ...display, writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.12em" }}
          className="text-white/35 text-[10px] font-semibold uppercase">
          {gallery.name}
        </span>
      </aside>

      {/* Right sidebar — back to top, top-to-bottom */}
      <aside className="fixed right-0 top-0 bottom-0 w-10 flex flex-col items-center justify-start pt-8 z-10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ ...display, writingMode: "vertical-rl", letterSpacing: "0.12em" }}
          className="text-white/25 hover:text-white/60 text-[10px] font-semibold uppercase transition-colors">
          Back to top
        </button>
      </aside>

      {/* Header */}
      <header className="fixed top-0 left-10 right-10 h-14 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          {gallery.logoKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl(gallery.logoKey)!} alt="" className="h-6 w-auto object-contain" />
          )}
        </div>
        <div className="flex items-center gap-5">
          <button onClick={() => openLightbox(0, true)}
            style={display}
            className="text-white/45 hover:text-white text-[11px] tracking-[0.18em] uppercase transition-colors">
            Slideshow
          </button>
          {starredIds.size > 0 && !submitted && (
            <button onClick={submitSelection} disabled={submitting}
              style={display}
              className="text-[11px] tracking-[0.18em] uppercase border border-white/30 hover:border-white px-3 py-1.5 text-white/80 hover:text-white disabled:opacity-50 transition-all">
              {submitting ? "Submitting…" : `Submit ${starredIds.size}`}
            </button>
          )}
          {submitted && (
            <span style={display} className="text-[11px] tracking-[0.12em] text-white/40 uppercase">
              Submitted ✓
            </span>
          )}
        </div>
      </header>

      {/* Masonry grid */}
      <div className="ml-10 mr-10 pt-14">
        <div ref={gridRef} className="masonry-grid">
          {photos.map((photo, idx) => {
            const starred = starredIds.has(photo.id)
            const commentCount = (commentMap[photo.id] ?? []).length
            return (
              <div
                key={photo.id}
                data-delay={Math.min(idx * 50, 400)}
                className={`photo-card group relative cursor-pointer overflow-hidden
                  ${starred ? "ring-2 ring-white ring-inset" : ""}`}
                onClick={() => openLightbox(idx)}
              >
                {photo.thumbKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgUrl(photo.thumbKey)!} alt={photo.filename} loading="lazy"
                    className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="aspect-square bg-neutral-900" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between
                  px-2 py-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                  <button onClick={(e) => { e.stopPropagation(); toggleStar(photo.id) }}
                    className="p-1.5 rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110 active:scale-95">
                    <Star className={`h-3.5 w-3.5 ${starred ? "fill-yellow-400 text-yellow-400" : "text-neutral-600"}`} />
                  </button>
                  {commentCount > 0 && (
                    <span className="text-[10px] bg-white text-black px-1.5 py-0.5 font-medium">{commentCount}</span>
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
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span style={display} className="text-white/40 text-[11px] tracking-[0.1em] uppercase">
              {(activeIdx ?? 0) + 1} / {photos.length}
            </span>
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
                  { key: "brightness" as const, label: "Brightness", min: 0.5, max: 2,   step: 0.05 },
                  { key: "contrast"   as const, label: "Contrast",   min: 0.5, max: 2,   step: 0.05 },
                  { key: "saturation" as const, label: "Saturation", min: 0,   max: 2,   step: 0.05 },
                  { key: "sharpness"  as const, label: "Sharpness",  min: 0,   max: 1,   step: 0.05 },
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

          {/* SVG sharpen filter */}
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
                {/* PREV / NEXT text navigation */}
                <button onClick={() => { setIsSlideshow(false); goPrev() }}
                  disabled={(activeIdx ?? 0) === 0}
                  style={display}
                  className="absolute left-8 bottom-8 text-white/50 hover:text-white disabled:opacity-20 text-[11px] tracking-[0.22em] uppercase font-semibold transition-colors z-10">
                  Prev
                </button>
                <button onClick={() => { setIsSlideshow(false); goNext() }}
                  disabled={(activeIdx ?? 0) === photos.length - 1}
                  style={display}
                  className="absolute right-8 bottom-8 text-white/50 hover:text-white disabled:opacity-20 text-[11px] tracking-[0.22em] uppercase font-semibold transition-colors z-10">
                  Next
                </button>
                {showTip && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-neutral-900/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl w-72 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Editing tools</span>
                      <button onClick={dismissTip} title="Got it" className="p-0.5 rounded hover:bg-white/10 transition-colors">
                        <X className="h-3.5 w-3.5 text-white/40" />
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {([
                        [SlidersHorizontal, "Tap the sliders icon to adjust brightness, contrast, sharpness & apply filters"],
                        [Crop,              "Tap the crop icon to select a region and export it"],
                        [Download,          "Tap the download icon to save with edits or download the original"],
                      ] as const).map(([Icon, text], i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-white/50 mt-0.5" />
                          <span className="text-white/70 text-xs leading-snug">{text}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={dismissTip}
                      className="mt-3 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors">
                      Got it
                    </button>
                  </div>
                )}
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
