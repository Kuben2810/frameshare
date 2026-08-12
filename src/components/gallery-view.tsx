"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Star, MessageSquare, Download, X, Send, Play, Pause, SlidersHorizontal, RotateCcw, Crop, ShoppingBag, ZoomIn, ZoomOut, Info, ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, stars, comments } from "@/db/schema"
import { FILTERS } from "@/lib/gallery-filters"
import { useGalleryInteraction } from "@/lib/hooks/use-gallery-interaction"
import { useSlideshow } from "@/lib/hooks/use-slideshow"
import { LightboxCrop } from "@/components/lightbox-crop"
import { AshadeCursor } from "@/components/ashade-cursor"
import { AshadeSidebar } from "@/components/ashade-sidebar"
import { WebGLDistortion } from "@/components/webgl-distortion"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>
type Star = InferSelectModel<typeof stars>
type Comment = InferSelectModel<typeof comments>
type Layout = "masonry" | "ribbon"
type EntryAnim = "fade-up" | "fade" | "scale"

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
  // ── Tools state ────────────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false)
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

  // ── Layout state ───────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<Layout>("masonry")
  const [entryAnim, setEntryAnim] = useState<EntryAnim>("fade-up")
  const [masonryCols, setMasonryCols] = useState<2|3|4>(3)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { starredIds, commentMap, submitting, submitted, toggleStar, submitComment, submitSelection } =
    useGalleryInteraction(gallery.slug, initialStars, initialComments)

  const { activeIdx, isSlideshow, setIsSlideshow, openLightbox, closeLightbox, goNext, goPrev } =
    useSlideshow(photos.length)

  const activePhoto = activeIdx !== null ? photos[activeIdx] : null

  // ── Lightbox spring physics ────────────────────────────────────────────────
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

  // ── Restore persisted prefs ────────────────────────────────────────────────
  useEffect(() => {
    const l = localStorage.getItem("gallery-layout") as Layout | null
    const a = localStorage.getItem("gallery-entry-anim") as EntryAnim | null
    const c = Number(localStorage.getItem("gallery-masonry-cols")) as 2|3|4
    if (l) setLayout(l)
    if (a) setEntryAnim(a)
    if (c === 2 || c === 3 || c === 4) setMasonryCols(c)
  }, [])

  // ── Lightbox open/close side effects ──────────────────────────────────────
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

  // ── Scroll-aware header ────────────────────────────────────────────────────
  useEffect(() => {
    const el = document.querySelector(".ashade-gallery-main")
    if (!el) return
    const onScroll = () => setIsScrolled(el.scrollTop > 60)
    el.addEventListener("scroll", onScroll)
    return () => el.removeEventListener("scroll", onScroll)
  }, [])

  // ── Intersection observer (scroll-reveal) ─────────────────────────────────
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
      { threshold: 0.06 }
    )
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [photos, layout])

  // ── Ribbon physics ─────────────────────────────────────────────────────────
  const ribbonContainerRef = useRef<HTMLDivElement>(null)
  const ribbonTrackRef = useRef<HTMLDivElement>(null)
  const ribbonDrag = useRef({ startX: 0, lastX: 0, velocity: 0, pos: 0, isDown: false, hasMoved: false, lastTime: 0 })
  const ribbonMaxRef = useRef(1)
  const ribbonRafRef = useRef<number | null>(null)
  const [ribbonPos, setRibbonPos] = useState(0)
  const [ribbonDragging, setRibbonDragging] = useState(false)

  const updateRibbonMax = useCallback(() => {
    if (!ribbonContainerRef.current || !ribbonTrackRef.current) return
    const max = Math.max(0, ribbonTrackRef.current.scrollWidth - ribbonContainerRef.current.clientWidth + 60)
    ribbonMaxRef.current = max
  }, [])

  useEffect(() => {
    if (layout !== "ribbon") return
    updateRibbonMax()
    window.addEventListener("resize", updateRibbonMax)
    return () => window.removeEventListener("resize", updateRibbonMax)
  }, [layout, updateRibbonMax, photos])

  useEffect(() => {
    if (layout !== "ribbon") return
    const d = ribbonDrag.current
    const loop = () => {
      if (!d.isDown && Math.abs(d.velocity) > 0.1) {
        d.pos += d.velocity
        d.velocity *= 0.92
        d.pos = Math.max(-50, Math.min(ribbonMaxRef.current + 50, d.pos))
        setRibbonPos(d.pos)
      }
      ribbonRafRef.current = requestAnimationFrame(loop)
    }
    ribbonRafRef.current = requestAnimationFrame(loop)
    return () => { if (ribbonRafRef.current) cancelAnimationFrame(ribbonRafRef.current) }
  }, [layout])

  function ribbonDragStart(clientX: number) {
    const d = ribbonDrag.current
    d.isDown = true; d.startX = clientX; d.lastX = clientX
    d.velocity = 0; d.hasMoved = false; d.lastTime = performance.now()
    setRibbonDragging(true)
  }
  function ribbonDragMove(clientX: number) {
    const d = ribbonDrag.current
    if (!d.isDown) return
    const deltaX = d.lastX - clientX
    if (Math.abs(deltaX) > 3) d.hasMoved = true
    const now = performance.now(); const dt = Math.max(1, now - d.lastTime)
    d.velocity = (deltaX / dt) * 14
    d.pos = Math.max(-50, Math.min(ribbonMaxRef.current + 50, d.pos + deltaX))
    d.lastX = clientX; d.lastTime = now
    setRibbonPos(d.pos)
  }
  function ribbonDragEnd() {
    ribbonDrag.current.isDown = false
    setTimeout(() => setRibbonDragging(false), 50)
  }



  // ── Download with edits ────────────────────────────────────────────────────
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

  function changeLayout(l: Layout) { setLayout(l); localStorage.setItem("gallery-layout", l) }
  function changeAnim(a: EntryAnim) { setEntryAnim(a); localStorage.setItem("gallery-entry-anim", a) }
  function changeCols(n: 2|3|4) { setMasonryCols(n); localStorage.setItem("gallery-masonry-cols", String(n)) }
  function dismissTip() { setShowTip(false); localStorage.setItem("lb-tip-dismissed", "1") }
  function compareMoveAt(clientX: number) {
    if (!compareRef.current || !compareDragging.current) return
    const rect = compareRef.current.getBoundingClientRect()
    setComparePos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }



  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ── Shared card interior ───────────────────────────────────────────────────
  function cardInner(photo: Photo, coverFit: boolean) {
    const starred = starredIds.has(photo.id)
    const thumb = imgUrl(photo.thumbKey)
    const title = photo.filename.replace(/\.[^.]+$/, "")
    const fileType = photo.mimeType.split("/")[1]?.toUpperCase() ?? "IMG"
    return (
      <>
        {thumb ? (
          <WebGLDistortion src={thumb} alt={photo.filename}
            className={coverFit ? "w-full h-full" : ""}
            style={coverFit ? {} : { height: "auto" }}
            intensity={1.0} speed={1.0}
          />
        ) : (
          <div className={`${coverFit ? "w-full h-full" : "aspect-square"} bg-neutral-900`} />
        )}
        {/* Gradient hover overlay — clone style */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.04) 60%, transparent 100%)" }}>
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <span className="block text-[9px] font-bold tracking-[2px] uppercase text-white/50 mb-1">{fileType}</span>
            <h3 className="text-sm font-bold text-white truncate leading-tight" style={display}>{title}</h3>
            {photo.width && photo.height && (
              <p className="text-[11px] text-white/40 mt-1">{photo.width} × {photo.height}</p>
            )}
          </div>
        </div>
        {/* Star + comment count */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={(e) => { e.stopPropagation(); toggleStar(photo.id) }}
            className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm shadow-sm transition-transform hover:scale-110 active:scale-95">
            <Star className={`h-3.5 w-3.5 ${starred ? "fill-yellow-400 text-yellow-400" : "text-white/80"}`} />
          </button>
          {(commentMap[photo.id]?.length ?? 0) > 0 && (
            <span className="text-[10px] bg-white text-black px-1.5 py-0.5 font-medium rounded">
              {commentMap[photo.id].length}
            </span>
          )}
        </div>
      </>
    )
  }

  // ── Ribbon photo aspect ────────────────────────────────────────────────────
  function ribbonAspect(photo: Photo) {
    const ar = (photo.width && photo.height) ? photo.width / photo.height : 1.5
    return ar >= 1 ? "aspect-landscape" : "aspect-portrait"
  }

  return (
    <div className="ashade-app min-h-screen bg-black text-white">
      {/* Physics cursor */}
      <AshadeCursor />

      {/* Sidebar */}
      <AshadeSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        gallery={gallery}
        starredCount={starredIds.size}
        totalCount={photos.length}
        submitted={submitted}
        submitting={submitting}
        onSubmit={submitSelection}
      />

      {/* ── Header ── */}
      <header className={`ashade-header ${isScrolled ? "is-scrolled" : ""}`}>
        <div className="ashade-header-inner">
          {/* Logo */}
          <a className="ashade-logo" href="#" onClick={(e) => e.preventDefault()} data-cursor="link">
            {gallery.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" className="h-7 w-auto object-contain" />
            ) : (
              <>
                <span className="ashade-logo-text">{gallery.name}</span>
                <span className="ashade-logo-tag">Photography Gallery</span>
              </>
            )}
          </a>

          {/* Nav */}
          <div className="ashade-nav-block">
            <nav className="ashade-nav">
              <ul className="main-menu">
                {/* Layout pickers */}
                {(["masonry", "ribbon"] as const).map((l) => (
                  <li key={l} className={layout === l ? "is-active" : ""}>
                    <button className="nav-link" style={display} onClick={() => changeLayout(l)} data-cursor="link">
                      {l === "masonry" ? "Mason" : "Ribbon"}
                    </button>
                  </li>
                ))}

                {/* Slideshow */}
                <li>
                  <button className="nav-link" style={display} onClick={() => openLightbox(0, true)} data-cursor="link">
                    Slideshow
                  </button>
                </li>

                {/* Submit */}
                {starredIds.size > 0 && !submitted && (
                  <li>
                    <button className="nav-link"
                      style={{ ...display, border: "1px solid rgba(255,255,255,0.25)", padding: "5px 14px" }}
                      onClick={submitSelection} disabled={submitting} data-cursor="link">
                      {submitting ? "Submitting…" : `Submit ${starredIds.size}`}
                    </button>
                  </li>
                )}

                {/* Sidebar toggle */}
                <li>
                  <button className="ashade-hamburger" onClick={() => setIsSidebarOpen(true)} data-cursor="link" title="Open sidebar">
                    <span className="bar" />
                    <span className="bar" />
                    <span className="bar" />
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Gallery main scroll area ── */}
      <div className="ashade-gallery-main" style={{ position: "relative", zIndex: 2, minHeight: "100vh", overflowY: "auto" }}>
        <div style={{ paddingTop: 100 }}>

          {/* Controls bar — column switcher (masonry) + animation picker */}
          <div className="flex items-center justify-between py-2 px-12 mb-0.5">
            {layout === "masonry" ? (
              <div className="flex items-center gap-1.5">
                <span className="text-white/25 text-[9px] uppercase tracking-widest" style={display}>Cols</span>
                {([2, 3, 4] as const).map(n => (
                  <button key={n} onClick={() => changeCols(n)} data-cursor="link"
                    className={`w-7 h-7 flex items-center justify-center rounded border text-[10px] font-bold transition-colors
                      ${masonryCols === n ? "border-white/60 text-white" : "border-white/12 text-white/25 hover:text-white/50 hover:border-white/30"}`}>
                    {n}
                  </button>
                ))}
              </div>
            ) : <div />}
            <div className="flex items-center">
              {(["fade-up", "fade", "scale"] as const).map((a) => (
                <button key={a} onClick={() => changeAnim(a)} style={display} data-cursor="link"
                  className={`px-2.5 py-1 text-[9px] tracking-[0.15em] uppercase transition-colors border-b ml-1
                    ${entryAnim === a ? "border-white/60 text-white" : "border-transparent text-white/25 hover:text-white/50"}`}>
                  {a === "fade-up" ? "Fade ↑" : a === "fade" ? "Fade" : "Zoom"}
                </button>
              ))}
            </div>
          </div>

          {/* ── MASONRY ── */}
          {layout === "masonry" && (
            <div ref={gridRef} className="masonry-grid px-2" data-anim={entryAnim} style={{ columns: masonryCols }}>
              {photos.map((photo, idx) => {
                const starred = starredIds.has(photo.id)
                return (
                  <div key={photo.id} data-delay={Math.min(idx * 50, 400)}
                    className={`photo-card group relative cursor-pointer overflow-hidden ${starred ? "ring-2 ring-white ring-inset" : ""}`}
                    onClick={() => openLightbox(idx)} data-cursor="zoom">
                    {cardInner(photo, false)}
                  </div>
                )
              })}
            </div>
          )}



          {/* ── RIBBON ── */}
          {layout === "ribbon" && (
            <div className="ribbon-layout-outer px-0">
              <div
                ref={ribbonContainerRef}
                className={`ribbon-viewport ${ribbonDragging ? "is-dragging" : ""}`}
                data-cursor="slider"
                onMouseDown={(e) => ribbonDragStart(e.clientX)}
                onMouseMove={(e) => ribbonDragMove(e.clientX)}
                onMouseUp={ribbonDragEnd}
                onMouseLeave={ribbonDragEnd}
                onTouchStart={(e) => ribbonDragStart(e.touches[0].clientX)}
                onTouchMove={(e) => ribbonDragMove(e.touches[0].clientX)}
                onTouchEnd={ribbonDragEnd}
                onWheel={(e) => {
                  const d = e.deltaY !== 0 ? e.deltaY : e.deltaX
                  ribbonDrag.current.pos = Math.max(0, Math.min(ribbonMaxRef.current, ribbonDrag.current.pos + d * 1.2))
                  ribbonDrag.current.velocity = 0
                  setRibbonPos(ribbonDrag.current.pos)
                }}
              >
                <div ref={ribbonTrackRef} className="ribbon-track"
                  style={{ transform: `translate3d(${-ribbonPos}px, 0, 0)` }}>
                  {photos.map((photo, idx) => {
                    const thumb = imgUrl(photo.thumbKey)
                    return (
                      <div key={photo.id}
                        className={`ribbon-item ${ribbonAspect(photo)}`}
                        onClick={() => { if (!ribbonDrag.current.hasMoved) openLightbox(idx) }}
                        data-cursor="zoom">
                        <div className="ribbon-item-inner">
                          {thumb && (
                            <WebGLDistortion src={thumb} alt={photo.filename} intensity={1.2} speed={0.8} />
                          )}
                          <div className="ribbon-item-overlay">
                            <span className="ribbon-item-category">{idx + 1} / {photos.length}</span>
                            <span className="ribbon-item-title">{photo.filename.replace(/\.[^.]+$/, "")}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="ribbon-progress-wrap px-12">
                <div className="ribbon-progress-track"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const ratio = (e.clientX - rect.left) / rect.width
                    const target = ratio * ribbonMaxRef.current
                    ribbonDrag.current.pos = target
                    ribbonDrag.current.velocity = 0
                    setRibbonPos(target)
                  }}>
                  <div className="ribbon-progress-fill"
                    style={{ width: `${ribbonMaxRef.current > 0 ? Math.min(100, (ribbonPos / ribbonMaxRef.current) * 100) : 0}%` }} />
                  <div className="ribbon-progress-handle"
                    style={{ left: `${ribbonMaxRef.current > 0 ? Math.min(100, (ribbonPos / ribbonMaxRef.current) * 100) : 0}%` }} />
                </div>
                <div className="ribbon-drag-hint">Drag horizontally or scroll to explore</div>
              </div>
            </div>
          )}



        </div>
      </div>

      {/* ── Lightbox ── */}
      {activePhoto && (
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
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ zIndex: 60 }}>
            <div className="flex items-center gap-2">
              <span style={display} className="text-white/40 text-[11px] tracking-[0.1em] uppercase">
                {gallery.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
              <button onClick={() => { setCompareMode(m => !m); setComparePos(50) }} data-cursor="link"
                className={`p-2 rounded-full transition-colors ${compareMode ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}
                title="Before / After compare">
                <ArrowLeftRight className="h-4 w-4 text-white" />
              </button>
              <button onClick={() => toggleStar(activePhoto.id)} data-cursor="link"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Star className={`h-4 w-4 ${starredIds.has(activePhoto.id) ? "fill-yellow-400 text-yellow-400" : "text-white"}`} />
              </button>
              <button onClick={() => setCommentPhotoId(commentPhotoId === activePhoto.id ? null : activePhoto.id)}
                data-cursor="link" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors relative">
                <MessageSquare className="h-4 w-4 text-white" />
                {(commentMap[activePhoto.id]?.length ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium">
                    {commentMap[activePhoto.id].length}
                  </span>
                )}
              </button>
              {gallery.downloadMode !== "none" && (
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(m => !m)} data-cursor="link"
                    className={`p-2 rounded-full transition-colors ${showDownloadMenu ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
                    <Download className="h-4 w-4 text-white" />
                  </button>
                  {showDownloadMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-neutral-900 border border-white/10 rounded-lg overflow-hidden text-sm w-48 z-20 shadow-xl">
                        <button onClick={downloadWithEdits} data-cursor="link"
                          className="w-full px-4 py-2.5 text-left text-white hover:bg-white/10 transition-colors">
                          Download with edits
                        </button>
                        <a href={imgUrl(gallery.downloadMode === "lowres" ? activePhoto.watermarkedKey : activePhoto.originalKey) ?? "#"}
                          download={activePhoto.filename} onClick={() => setShowDownloadMenu(false)} data-cursor="link"
                          className="block px-4 py-2.5 text-white hover:bg-white/10 transition-colors">
                          Download original
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button onClick={closeLightbox} data-cursor="close"
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
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

          {/* ── Image area — curtain spring slider ── */}
          <div className="relative flex-1 min-h-0 overflow-hidden" data-cursor="zoom">
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
            {compareMode && activePhoto && (() => {
              const src = imgUrl(activePhoto.displayKey ?? activePhoto.originalKey)!
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
                  {/* After — with filter */}
                  <div className="lb-compare-layer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="after" className="lb-compare-img" style={{ filter: appliedFilter || undefined }} />
                    <div className="lb-compare-badge lb-badge-after">Edited</div>
                  </div>
                  {/* Before — no filter, clipped */}
                  <div className="lb-compare-layer lb-compare-before" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="before" className="lb-compare-img" />
                    <div className="lb-compare-badge lb-badge-before">Original</div>
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

            {/* Details panel — slide in from right */}
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
      )}
    </div>
  )
}
