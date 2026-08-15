"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Star, MessageSquare, Download, X, Send, Play, Pause,
  SlidersHorizontal, RotateCcw, Crop, ZoomIn, ZoomOut,
  Info, ChevronLeft, ChevronRight, ArrowLeftRight,
} from "lucide-react"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, comments } from "@/db/schema"
import { FILTERS } from "@/lib/gallery-filters"
import { LightboxCrop } from "@/components/lightbox-crop"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>
type Comment = InferSelectModel<typeof comments>

const display = { fontFamily: "var(--font-oswald, 'Oswald', sans-serif)" }

function imgUrl(key: string | null | undefined) {
  if (!key) return null
  return `/api/s3/${key}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Lightbox({
  gallery,
  photos,
  activeIdx,
  isSlideshow,
  setIsSlideshow,
  goNext,
  goPrev,
  closeLightbox,
  starredIds,
  commentMap,
  submitComment,
  toggleStar,
  clientSection,
  proofingPhotos,
}: {
  gallery: Gallery
  photos: Photo[]
  activeIdx: number | null
  isSlideshow: boolean
  setIsSlideshow: (v: boolean | ((prev: boolean) => boolean)) => void
  goNext: () => void
  goPrev: () => void
  closeLightbox: () => void
  starredIds: Set<string>
  commentMap: Record<string, Comment[]>
  submitComment: (photoId: string, body: string, authorName: string) => Promise<boolean | undefined>
  toggleStar: (photoId: string) => Promise<void>
  clientSection?: "proofing" | "final"
  proofingPhotos?: Photo[]
}) {
  const activePhoto = activeIdx !== null ? photos[activeIdx] : null

  // ── Tools state ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false)
  const [showMobileTools, setShowMobileTools] = useState(false)
  const [activeFilter, setActiveFilter] = useState("Normal")
  const [adjustments, setAdjustments] = useState({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })
  const [cropMode, setCropMode] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showDetails, setShowDetails] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [comparePos, setComparePos] = useState(50)
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [commentName, setCommentName] = useState("")

  // ── Spring physics refs ────────────────────────────────────────────────────
  const zoomRef = useRef(1)
  const compareRef = useRef<HTMLDivElement>(null)
  const compareDragging = useRef(false)
  const lbPosRef = useRef(0)
  const lbTargetRef = useRef(0)
  const lbRafRef = useRef<number | null>(null)
  const lbPrevOpenIdx = useRef<number | null>(null)
  const slideRefs = useRef(new Map<number, HTMLDivElement>())
  const imageRefs = useRef(new Map<number, HTMLImageElement>())
  const counterRef = useRef<HTMLSpanElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)

  // Photos window around activeIdx for the curtain slider
  const renderRange = useMemo(() => {
    if (activeIdx === null) return []
    const from = Math.max(0, activeIdx - 2)
    const to = Math.min(photos.length - 1, activeIdx + 2)
    return photos.slice(from, to + 1).map((p, i) => ({ photo: p, absIdx: from + i }))
  }, [activeIdx, photos])

  function updateSlides(pos: number) {
    for (const [idx, el] of slideRefs.current.entries()) {
      const rel = idx - pos
      el.style.transform = `translate3d(${rel * 100}%, 0, 0)`
      const img = imageRefs.current.get(idx)
      if (img) {
        const zoom = idx === lbTargetRef.current ? zoomRef.current : 1
        img.style.transform = `translate3d(${-rel * 45}%, 0, 0) scale(${1.15 * zoom})`
      }
    }
    if (counterRef.current) {
      counterRef.current.textContent = `${Math.round(pos) + 1}`
    }
    if (progressFillRef.current) {
      progressFillRef.current.style.width = `${((pos + 1) / photos.length) * 100}%`
    }
  }

  useEffect(() => {
    if (activeIdx === null) {
      if (lbRafRef.current) cancelAnimationFrame(lbRafRef.current)
      lbPrevOpenIdx.current = null
      return
    }
    lbTargetRef.current = activeIdx
    const isFirst = lbPrevOpenIdx.current === null
    lbPrevOpenIdx.current = activeIdx
    if (isFirst) {
      lbPosRef.current = activeIdx
      updateSlides(activeIdx)
      return
    }
    const lerp = () => {
      const diff = lbTargetRef.current - lbPosRef.current
      lbPosRef.current += diff * 0.12
      updateSlides(lbPosRef.current)
      if (Math.abs(diff) > 0.001) {
        lbRafRef.current = requestAnimationFrame(lerp)
      }
    }
    if (lbRafRef.current) cancelAnimationFrame(lbRafRef.current)
    lbRafRef.current = requestAnimationFrame(lerp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx])

  // ── Filter / adjustment CSS ────────────────────────────────────────────────
  const filterCss = FILTERS[activeFilter] ?? ""
  const { brightness, contrast, saturation, sharpness } = adjustments
  const hasAdjustments = brightness !== 1 || contrast !== 1 || saturation !== 1 || sharpness !== 0
  const editCss = [
    sharpness > 0 && "url(#lb-sharpen)",
    brightness !== 1 && `brightness(${brightness})`,
    contrast !== 1 && `contrast(${contrast})`,
    saturation !== 1 && `saturate(${saturation})`,
  ].filter(Boolean).join(" ")
  const appliedFilter = [editCss, filterCss].filter(Boolean).join(" ")

  // ── Open/close side effects ────────────────────────────────────────────────
  useEffect(() => {
    setZoomLevel(1)
    if (activeIdx === null) {
      setAdjustments({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })
      setCropMode(false); setShowDownloadMenu(false); setShowTip(false); setShowDetails(false); setCompareMode(false)
    } else if (!localStorage.getItem("lb-tip-dismissed")) {
      setShowTip(true)
    }
  }, [activeIdx])

  // ── Sync zoom ref → update active slide immediately ────────────────────────
  useEffect(() => {
    zoomRef.current = zoomLevel
    if (activeIdx !== null) updateSlides(lbPosRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel])

  // ── Helpers ────────────────────────────────────────────────────────────────
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

  async function handleCommentSubmit(photoId: string) {
    const ok = await submitComment(photoId, commentBody, commentName)
    if (ok) { setCommentBody(""); setCommentPhotoId(null) }
  }

  function dismissTip() { setShowTip(false); localStorage.setItem("lb-tip-dismissed", "1") }

  // ── Mobile Touch Swipe Handling (Resilient touchmove & touchend) ───────────
  const touchStateRef = useRef<{
    startX: number
    startY: number
    currentX: number
    currentY: number
    startTime: number
  } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1 || zoomLevel > 1 || compareMode || cropMode) {
      touchStateRef.current = null
      return
    }
    const touch = e.touches[0]
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStateRef.current || zoomLevel > 1) return
    const touch = e.touches[0]
    if (!touch) return
    touchStateRef.current.currentX = touch.clientX
    touchStateRef.current.currentY = touch.clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStateRef.current || zoomLevel > 1) return
    const { startX, startY, currentX, currentY, startTime } = touchStateRef.current
    touchStateRef.current = null

    const deltaX = currentX - startX
    const deltaY = currentY - startY
    const elapsed = Date.now() - startTime

    // Horizontal Swipe (flick or > 30px distance)
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.1
    if (isHorizontal && (Math.abs(deltaX) > 30 || (elapsed < 350 && Math.abs(deltaX) > 20))) {
      if (deltaX < 0) {
        goNext()
      } else {
        goPrev()
      }
      return
    }

    // Vertical Swipe Down to dismiss (> 60px down)
    const isVerticalDown = deltaY > 60 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3
    if (isVerticalDown) {
      closeLightbox()
      return
    }
  }

  function compareMoveAt(clientX: number) {
    if (!compareRef.current || !compareDragging.current) return
    const rect = compareRef.current.getBoundingClientRect()
    setComparePos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }

  if (!activePhoto) return null

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col lb-open">
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

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 shrink-0 relative z-[60]">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span style={display} className="text-white/40 text-[11px] tracking-[0.1em] uppercase truncate max-w-[120px] sm:max-w-xs">
            {gallery.name}
          </span>
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Desktop-only tool buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button onClick={() => setShowFilters(f => !f)} data-cursor="link"
              className={`p-2 rounded-full transition-colors ${showFilters ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
              title="Filters & adjustments">
              <SlidersHorizontal className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => setCropMode(m => !m)} data-cursor="link"
              className={`p-2 rounded-full transition-colors ${cropMode ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
              title="Crop">
              <Crop className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => setIsSlideshow(s => !s)} data-cursor="link"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              {isSlideshow ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
            </button>
            <button onClick={() => setZoomLevel(z => Math.max(1, z - 0.5))} data-cursor="link"
              className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${zoomLevel <= 1 ? "opacity-30" : ""}`}
              title="Zoom out">
              <ZoomOut className="h-4 w-4 text-white" />
            </button>
            {zoomLevel !== 1 && (
              <span style={display} className="text-white/50 text-[10px] min-w-[28px] text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
            )}
            <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.5))} data-cursor="link"
              className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ${zoomLevel >= 3 ? "opacity-30" : ""}`}
              title="Zoom in">
              <ZoomIn className="h-4 w-4 text-white" />
            </button>
            <button onClick={() => setShowDetails(d => !d)} data-cursor="link"
              className={`p-2 rounded-full transition-colors ${showDetails ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
              title="Photo details">
              <Info className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={() => { setCompareMode(m => !m); setComparePos(50) }}
              data-cursor="link"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                compareMode
                  ? "bg-amber-400 text-black shadow-md font-bold"
                  : clientSection === "final"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
              title="Before / After split comparison"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>{compareMode ? "Comparing" : "Compare"}</span>
            </button>
          </div>

          {/* Mobile Tools Dropdown Menu */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowMobileTools(m => !m)}
              className={`p-2 rounded-full transition-colors ${showMobileTools ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
              title="More tools"
            >
              <SlidersHorizontal className="h-4 w-4 text-white" />
            </button>

            {showMobileTools && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileTools(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 divide-y divide-white/10 text-xs">
                  <div className="py-1">
                    <button
                      onClick={() => { setShowFilters(f => !f); setShowMobileTools(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-left transition-colors"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-white/70" />
                      <span>{showFilters ? "Hide Filters" : "Filters & Sliders"}</span>
                    </button>
                    <button
                      onClick={() => { setCropMode(m => !m); setShowMobileTools(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-left transition-colors"
                    >
                      <Crop className="h-4 w-4 text-white/70" />
                      <span>Crop Tool</span>
                    </button>
                    <button
                      onClick={() => { setIsSlideshow(s => !s); setShowMobileTools(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-left transition-colors"
                    >
                      {isSlideshow ? <Pause className="h-4 w-4 text-white/70" /> : <Play className="h-4 w-4 text-white/70" />}
                      <span>{isSlideshow ? "Pause Slideshow" : "Play Slideshow"}</span>
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowDetails(d => !d); setShowMobileTools(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-left transition-colors"
                    >
                      <Info className="h-4 w-4 text-white/70" />
                      <span>Photo Details</span>
                    </button>
                    <button
                      onClick={() => { setCompareMode(m => !m); setComparePos(50); setShowMobileTools(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 text-left transition-colors"
                    >
                      <ArrowLeftRight className="h-4 w-4 text-white/70" />
                      <span>Before / After</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Star with Live Limit Countdown */}
          <div className="flex items-center gap-1.5 bg-white/10 p-0.5 pl-1.5 pr-2 rounded-full border border-white/15">
            <button
              onClick={() => toggleStar(activePhoto.id)}
              data-cursor="link"
              className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all cursor-pointer"
              title={starredIds.has(activePhoto.id) ? "Remove from selection" : "Select for retouching"}
            >
              <Star className={`h-4 w-4 ${starredIds.has(activePhoto.id) ? "fill-yellow-400 text-yellow-400" : "text-white"}`} />
            </button>
            {gallery.maxSelections ? (
              <span className="text-[11px] font-mono text-white/80 select-none">
                <strong className={
                  starredIds.size > gallery.maxSelections
                    ? "text-amber-400 font-bold"
                    : starredIds.size === gallery.maxSelections
                    ? "text-emerald-400 font-bold"
                    : "text-white"
                }>
                  {starredIds.size}
                </strong>
                <span className="text-white/40">/{gallery.maxSelections}</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono text-white/80 select-none">
                {starredIds.size}
              </span>
            )}
          </div>

          {/* Comment (Always visible) */}
          <button onClick={() => setCommentPhotoId(commentPhotoId === activePhoto.id ? null : activePhoto.id)}
            data-cursor="link" className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all relative">
            <MessageSquare className="h-4 w-4 text-white" />
            {(commentMap[activePhoto.id]?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                {commentMap[activePhoto.id].length}
              </span>
            )}
          </button>

          {/* Download (Always visible if enabled) */}
          {gallery.downloadMode !== "none" && (
            <div className="relative">
              <button onClick={() => setShowDownloadMenu(m => !m)} data-cursor="link"
                className={`p-2 rounded-full transition-colors ${showDownloadMenu ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
                <Download className="h-4 w-4 text-white" />
              </button>
              {showDownloadMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 bg-neutral-900/95 backdrop-blur-md border border-white/15 rounded-xl overflow-hidden text-xs w-48 z-50 shadow-2xl p-1">
                    <button onClick={downloadWithEdits} data-cursor="link"
                      className="w-full px-3 py-2 text-left text-white hover:bg-white/10 rounded-lg transition-colors">
                      Download with edits
                    </button>
                    <a href={imgUrl(gallery.downloadMode === "lowres" ? activePhoto.watermarkedKey : activePhoto.originalKey) ?? "#"}
                      download={activePhoto.filename} onClick={() => setShowDownloadMenu(false)} data-cursor="link"
                      className="block px-3 py-2 text-white hover:bg-white/10 rounded-lg transition-colors">
                      Download original
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Close button (Always prominently visible) */}
          <button onClick={closeLightbox} data-cursor="close"
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all ml-0.5"
            title="Close lightbox">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Filters + adjustments */}
      {showFilters && (
        <div className="px-4 pb-3 space-y-2 shrink-0 animate-in slide-in-from-top-2 duration-200" style={{ zIndex: 60 }}>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {Object.keys(FILTERS).map((name) => (
              <button key={name} onClick={() => setActiveFilter(name)} data-cursor="link"
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                  ${activeFilter === name ? "bg-white text-black scale-105" : "bg-white/15 text-white/80 hover:bg-white/25"}`}>
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
                <input type="range" min={min} max={max} step={step} value={adjustments[key]}
                  onChange={(e) => setAdjustments((a) => ({ ...a, [key]: +e.target.value }))}
                  className="w-full accent-white" data-cursor="link" />
              </label>
            ))}
            <button onClick={() => setAdjustments({ brightness: 1, contrast: 1, saturation: 1, sharpness: 0 })}
              disabled={!hasAdjustments} data-cursor="link"
              className="shrink-0 p-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-20 transition-colors mt-3.5">
              <RotateCcw className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Image area — curtain spring slider with touch swipe ── */}
      <div
        className="relative flex-1 min-h-0 overflow-hidden select-none"
        style={{ touchAction: "none" }}
        data-cursor="zoom"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Curtain slides */}
        {renderRange.map(({ photo, absIdx }) => {
          const src = imgUrl(photo.displayKey ?? photo.originalKey)
          const isActive = absIdx === activeIdx
          return (
            <div key={photo.id}
              ref={(el) => { if (el) slideRefs.current.set(absIdx, el); else slideRefs.current.delete(absIdx) }}
              className="lb-curtain-slide"
              style={{ transform: `translate3d(${(absIdx - (activeIdx ?? 0)) * 100}%, 0, 0)` }}>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={(el) => { if (el) imageRefs.current.set(absIdx, el); else imageRefs.current.delete(absIdx) }}
                  src={src} alt={photo.filename}
                  className="lb-curtain-img"
                  style={{
                    filter: isActive ? appliedFilter : undefined,
                    transform: `translate3d(${-(absIdx - (activeIdx ?? 0)) * 45}%, 0, 0) scale(1.15)`,
                  }}
                />
              )}
              {/* Ken Burns for slideshow on active */}
              {isSlideshow && isActive && (
                <div className={`absolute inset-0 pointer-events-none ${(activeIdx ?? 0) % 2 === 0 ? "kb-even" : "kb-odd"}`}
                  style={{ zIndex: -1 }} />
              )}
            </div>
          )
        })}

        {/* Before / After compare mode */}
        {compareMode && (() => {
          const src = imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!
          const matchingProof = proofingPhotos?.find(
            (p) => p.filename === activePhoto.filename || p.filename.replace(/\.[^.]+$/, "") === activePhoto.filename.replace(/\.[^.]+$/, "")
          )
          const beforeSrc = matchingProof ? imgUrl(matchingProof.displayKey ?? matchingProof.originalKey)! : src

          return (
            <div ref={compareRef} className="lb-compare-stage"
              onMouseDown={(e) => { compareDragging.current = true; compareMoveAt(e.clientX) }}
              onMouseMove={(e) => compareMoveAt(e.clientX)}
              onMouseUp={() => { compareDragging.current = false }}
              onMouseLeave={() => { compareDragging.current = false }}
              onTouchStart={(e) => { compareDragging.current = true; compareMoveAt(e.touches[0].clientX) }}
              onTouchMove={(e) => compareMoveAt(e.touches[0].clientX)}
              onTouchEnd={() => { compareDragging.current = false }}
              data-cursor="slider">
              {/* After — with filter / retouched master */}
              <div className="lb-compare-layer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="after" className="lb-compare-img" style={{ filter: appliedFilter || undefined }} />
                <div className="lb-compare-badge lb-badge-after">Retouched Master</div>
              </div>
              {/* Before — raw / unretouched proof, clipped */}
              <div className="lb-compare-layer lb-compare-before" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={beforeSrc} alt="before" className="lb-compare-img" />
                <div className="lb-compare-badge lb-badge-before">{matchingProof ? "Original Proof" : "Original"}</div>
              </div>
              {/* Divider + handle */}
              <div className="lb-compare-divider" style={{ left: `${comparePos}%` }}>
                <div className="lb-compare-line" />
                <div className="lb-compare-handle" data-cursor="slider">
                  <ChevronLeft size={14} />
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          )
        })()}

        {/* Details panel */}
        {showDetails && (
          <div className="lb-details-panel">
            <p className="lb-detail-section-title">Technical Details</p>
            <ul className="lb-detail-list">
              <li className="lb-detail-item">
                <span className="lb-detail-label">Filename</span>
                <span className="lb-detail-value">{activePhoto.filename}</span>
              </li>
              {activePhoto.width && activePhoto.height && (
                <li className="lb-detail-item">
                  <span className="lb-detail-label">Dimensions</span>
                  <span className="lb-detail-value">{activePhoto.width} × {activePhoto.height} px</span>
                </li>
              )}
              <li className="lb-detail-item">
                <span className="lb-detail-label">File Size</span>
                <span className="lb-detail-value">{formatBytes(activePhoto.fileSizeBytes)}</span>
              </li>
              <li className="lb-detail-item">
                <span className="lb-detail-label">Uploaded</span>
                <span className="lb-detail-value">{new Date(activePhoto.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              </li>
              <li className="lb-detail-item">
                <span className="lb-detail-label">Type</span>
                <span className="lb-detail-value">{activePhoto.mimeType}</span>
              </li>
            </ul>
          </div>
        )}

        {/* Controls overlay */}
        {!cropMode && (
          <>
            <button onClick={() => { setIsSlideshow(false); goPrev() }}
              disabled={(activeIdx ?? 0) === 0} data-cursor="link" style={display}
              className="absolute left-8 bottom-20 text-white/50 hover:text-white disabled:opacity-20 text-[11px] tracking-[0.22em] uppercase font-semibold transition-colors z-30">
              Prev
            </button>
            <button onClick={() => { setIsSlideshow(false); goNext() }}
              disabled={(activeIdx ?? 0) === photos.length - 1} data-cursor="link" style={display}
              className="absolute right-8 bottom-20 text-white/50 hover:text-white disabled:opacity-20 text-[11px] tracking-[0.22em] uppercase font-semibold transition-colors z-30">
              Next
            </button>

            {/* Editing tip */}
            {showTip && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl w-72 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Editing tools</span>
                  <button onClick={dismissTip} data-cursor="close" className="p-0.5 rounded hover:bg-white/10">
                    <X className="h-3.5 w-3.5 text-white/40" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  {([
                    [SlidersHorizontal, "Adjust brightness, contrast, sharpness & apply filters"],
                    [Crop,              "Crop a region and export it"],
                    [Download,          "Download with edits or original"],
                  ] as const).map(([Icon, text], i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-white/50 mt-0.5" />
                      <span className="text-white/70 text-xs leading-snug">{text}</span>
                    </div>
                  ))}
                </div>
                <button onClick={dismissTip} data-cursor="link"
                  className="mt-3 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors">
                  Got it
                </button>
              </div>
            )}
          </>
        )}

        {/* Crop tool */}
        {cropMode && (
          <LightboxCrop
            imageUrl={imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!}
            naturalWidth={activePhoto.width ?? 0}
            naturalHeight={activePhoto.height ?? 0}
            filename={activePhoto.filename}
            onClose={() => setCropMode(false)}
          />
        )}

        {/* ── Bottom bar: counter + progress ── */}
        <div className="lb-bottom-bar">
          <div className="lb-slide-counter" style={display}>
            <span ref={counterRef}>{(activeIdx ?? 0) + 1}</span>
            <span className="sep">/</span>
            <span className="tot">{photos.length}</span>
          </div>
          <div className="lb-progress-track">
            <div ref={progressFillRef} className="lb-progress-fill"
              style={{ width: `${((activeIdx ?? 0) + 1) / photos.length * 100}%` }} />
          </div>
        </div>

        {/* Slideshow sweep bar */}
        {isSlideshow && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20" style={{ zIndex: 40 }}>
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
              placeholder="Your name (optional)" data-cursor="link"
              className="bg-white/10 rounded px-2 py-1.5 text-sm flex-1 outline-none placeholder:opacity-50 min-w-0 max-w-[140px]" />
            <input value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…" data-cursor="link"
              className="bg-white/10 rounded px-2 py-1.5 text-sm flex-1 outline-none placeholder:opacity-50"
              onKeyDown={(e) => e.key === "Enter" && handleCommentSubmit(activePhoto.id)} />
            <button onClick={() => handleCommentSubmit(activePhoto.id)} data-cursor="link"
              className="p-1.5 rounded bg-white/20 hover:bg-white/30 shrink-0 transition-colors">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
