"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Star, MessageSquare, Send, X, User, MessageCircle } from "lucide-react"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos, stars, comments } from "@/db/schema"
import { useStar } from "@/lib/hooks/use-star"
import { useComment } from "@/lib/hooks/use-comment"
import { useSelection } from "@/lib/hooks/use-selection"
import { useSlideshow } from "@/lib/hooks/use-slideshow"
import { AshadeCursor } from "@/components/ashade-cursor"
import { AshadeSidebar } from "@/components/ashade-sidebar"
import { WebGLDistortion } from "@/components/webgl-distortion"
import { Lightbox } from "@/components/lightbox"
import { Ribbon } from "@/components/ribbon"
import { cn } from "@/lib/utils"

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
  gallerySlug,
  hasMore: initialHasMore = false,
}: {
  gallery: Gallery
  photos: Photo[]
  initialStars: Star[]
  initialComments: Comment[]
  gallerySlug?: string
  hasMore?: boolean
}) {
  // ── Infinite scroll state ──────────────────────────────────────────────────
  const [morePhotos, setMorePhotos] = useState<Photo[]>([])
  const [hasMorePages, setHasMorePages] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const allPhotos = useMemo(() => [...photos, ...morePhotos], [photos, morePhotos])

  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMorePages || !gallerySlug) return
    setLoadingMore(true)
    try {
      const offset = photos.length + morePhotos.length
      const res = await fetch(`/api/galleries/${gallerySlug}/photos?offset=${offset}&limit=60`)
      if (!res.ok) { setHasMorePages(false); return }
      const data = await res.json()
      setMorePhotos((prev) => [...prev, ...data.photos])
      setHasMorePages(data.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMorePages, gallerySlug, photos.length, morePhotos.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container || !hasMorePages) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) fetchMore() },
      { root: container, rootMargin: "400px", threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMorePages, loadingMore, fetchMore])

  // ── Split Photos by Section ────────────────────────────────────────────────
  const proofingPhotos = allPhotos.filter((p) => (p.section ?? "proofing") === "proofing")
  const finalPhotos = allPhotos.filter((p) => p.section === "final")

  const defaultSection =
    gallery.stage === "delivered" && finalPhotos.length > 0
      ? "final"
      : proofingPhotos.length === 0 && finalPhotos.length > 0
      ? "final"
      : "proofing"

  const [currentSection, setCurrentSection] = useState<"proofing" | "final">(defaultSection)
  const activePhotos = currentSection === "final" ? finalPhotos : proofingPhotos

  // ── Quick Comment Modal State on Grid Thumbnails ──────────────────────────
  const [quickCommentPhoto, setQuickCommentPhoto] = useState<Photo | null>(null)
  const [quickCommentBody, setQuickCommentBody] = useState("")
  const [quickCommentAuthor, setQuickCommentAuthor] = useState("")
  const [isSubmittingQuickComment, setIsSubmittingQuickComment] = useState(false)

  // ── Layout state ───────────────────────────────────────────────────────────
  const [layout, setLayout] = useState<Layout>("masonry")
  const [entryAnim, setEntryAnim] = useState<EntryAnim>("fade-up")
  const [masonryCols, setMasonryCols] = useState<2|3|4>(3)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { starredIds, toggleStar } = useStar(gallery.slug, initialStars)
  const { commentMap, submitComment } = useComment(gallery.slug, initialComments)
  const { submitting, submitted, submitSelection } = useSelection(gallery.slug)

  const { activeIdx, isSlideshow, setIsSlideshow, openLightbox, closeLightbox, goNext, goPrev } =
    useSlideshow(activePhotos.length)

  async function handleSendQuickComment(e: React.FormEvent) {
    e.preventDefault()
    if (!quickCommentPhoto || !quickCommentBody.trim()) return
    setIsSubmittingQuickComment(true)
    try {
      await submitComment(quickCommentPhoto.id, quickCommentBody.trim(), quickCommentAuthor.trim())
      setQuickCommentBody("")
    } finally {
      setIsSubmittingQuickComment(false)
    }
  }

  // ── Restore persisted prefs ────────────────────────────────────────────────
  useEffect(() => {
    const l = localStorage.getItem("gallery-layout") as Layout | null
    const a = localStorage.getItem("gallery-entry-anim") as EntryAnim | null
    const c = Number(localStorage.getItem("gallery-masonry-cols")) as 2|3|4
    if (l) setLayout(l)
    if (a) setEntryAnim(a)
    if (c === 2 || c === 3 || c === 4) setMasonryCols(c)
  }, [])

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
  }, [activePhotos, layout])

  function changeLayout(l: Layout) { setLayout(l); localStorage.setItem("gallery-layout", l) }
  function changeAnim(a: EntryAnim) { setEntryAnim(a); localStorage.setItem("gallery-entry-anim", a) }
  function changeCols(n: 2|3|4) { setMasonryCols(n); localStorage.setItem("gallery-masonry-cols", String(n)) }

  // ── Shared card interior ───────────────────────────────────────────────────
  function cardInner(photo: Photo, coverFit: boolean) {
    const isProofing = currentSection === "proofing"
    const starred = starredIds.has(photo.id)
    const commentsList = commentMap[photo.id] ?? []
    const commentCount = commentsList.length
    // In proofing and final, thumbKey is 1200px and displayKey is 2560px QHD.
    // For 2-column or full layouts with wide cards, use displayKey for crystal-clear Retina viewing.
    const imageSrc = (masonryCols === 2 || layout === "ribbon")
      ? (imgUrl(photo.displayKey) ?? imgUrl(photo.thumbKey))
      : (imgUrl(photo.thumbKey) ?? imgUrl(photo.displayKey))
    const title = photo.filename.replace(/\.[^.]+$/, "")
    const fileType = photo.mimeType.split("/")[1]?.toUpperCase() ?? "IMG"

    return (
      <>
        {imageSrc ? (
          <WebGLDistortion
            src={imageSrc}
            alt={photo.filename}
            className={coverFit ? "w-full h-full" : ""}
            style={coverFit ? {} : { height: "auto" }}
            intensity={1.0}
            speed={1.0}
          />
        ) : (
          <div className={`${coverFit ? "w-full h-full" : "aspect-square"} bg-neutral-900`} />
        )}

        {/* Gradient hover overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.04) 60%, transparent 100%)" }}
        >
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <span className="block text-[9px] font-bold tracking-[2px] uppercase text-white/50 mb-1">{fileType}</span>
            <h3 className="text-sm font-bold text-white truncate leading-tight" style={display}>
              {title}
            </h3>
            {photo.width && photo.height && (
              <p className="text-[11px] text-white/40 mt-1">
                {photo.width} × {photo.height}
              </p>
            )}
          </div>
        </div>

        {/* PROOFING CONTROLS: Direct Star Selection + Comment Button on Thumbnail */}
        {isProofing && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
            {/* Star Selection Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleStar(photo.id)
              }}
              data-cursor="link"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer font-mono text-xs",
                starred
                  ? "bg-amber-400 text-black font-bold ring-2 ring-amber-300/60 shadow-amber-400/20"
                  : "bg-black/75 text-white/90 hover:bg-black hover:text-white border border-white/20"
              )}
              title={starred ? "Selected for retouching (click to unselect)" : "Select for retouching"}
            >
              <Star className={cn("h-3.5 w-3.5", starred ? "fill-black text-black" : "text-white")} />
              <span className="text-[11px] font-sans font-semibold">
                {starred ? "Selected" : "Select"}
              </span>
            </button>

            {/* Comment Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setQuickCommentPhoto(photo)
              }}
              data-cursor="link"
              className={cn(
                "p-1.5 px-2 rounded-full backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1",
                commentCount > 0
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-black/75 text-white/90 hover:bg-black hover:text-white border border-white/20"
              )}
              title={commentCount > 0 ? `${commentCount} note(s) - click to view/add` : "Add notes for editor"}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {commentCount > 0 && (
                <span className="text-[10px] font-bold font-mono">
                  {commentCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* FINAL DELIVERY BADGE: Clean, no starring or commenting */}
        {!isProofing && (
          <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="bg-amber-500/90 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm font-mono">
              Final Master ✨
            </span>
          </div>
        )}
      </>
    )
  }

  const hasBothSets = (proofingPhotos.length > 0 && finalPhotos.length > 0) || gallery.stage === "both"

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
      <header className="ashade-header">
        <div className="ashade-header-inner">
          {/* Logo */}
          <a className="ashade-logo min-w-0 pr-2" href="#" onClick={(e) => e.preventDefault()} data-cursor="link">
            {gallery.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" loading="lazy" className="h-7 w-auto object-contain" />
            ) : (
              <>
                <span className="ashade-logo-text truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
                  {gallery.name}
                </span>
                <span className="ashade-logo-tag">
                  {currentSection === "final" ? "Final Delivery Master" : "Proofing Collection"}
                </span>
              </>
            )}
          </a>

          {/* Center Stage Switcher (Always available so client/photographer can toggle sets) */}
          <div className="hidden sm:flex items-center bg-white/10 rounded-full p-1 border border-white/15">
            <button
              onClick={() => { setCurrentSection("proofing"); closeLightbox() }}
              className={`px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                currentSection === "proofing"
                  ? "bg-white text-black shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
              style={display}
            >
              🌟 Proofing ({proofingPhotos.length})
            </button>
            <button
              onClick={() => { setCurrentSection("final"); closeLightbox() }}
              className={`px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                currentSection === "final"
                  ? "bg-amber-400 text-black shadow-sm font-bold"
                  : "text-white/60 hover:text-white"
              }`}
              style={display}
            >
              ✨ Final Delivery ({finalPhotos.length})
            </button>
          </div>

          {/* Nav */}
          <div className="ashade-nav-block shrink-0">
            <nav className="ashade-nav">
              <ul className="main-menu">
                {/* Layout pickers (desktop) */}
                {(["masonry", "ribbon"] as const).map((l) => (
                  <li key={l} className={`hidden md:inline-block ${layout === l ? "is-active" : ""}`}>
                    <button className="nav-link" style={display} onClick={() => changeLayout(l)} data-cursor="link">
                      {l === "masonry" ? "Mason" : "Ribbon"}
                    </button>
                  </li>
                ))}

                {/* Slideshow (desktop) */}
                <li className="hidden md:inline-block">
                  <button className="nav-link" style={display} onClick={() => openLightbox(0, true)} data-cursor="link">
                    Slideshow
                  </button>
                </li>

                {/* Final Delivery: Direct Download All Button */}
                {currentSection === "final" && finalPhotos.length > 0 && gallery.downloadMode !== "none" && (
                  <li>
                    <a
                      href={`/api/galleries/${gallery.slug}/download?section=final`}
                      className="nav-link text-xs whitespace-nowrap font-bold inline-flex items-center gap-1"
                      style={{ ...display, border: "1px solid rgba(245,158,11,0.4)", padding: "5px 12px", background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
                      download
                    >
                      Download Masters ({finalPhotos.length})
                    </a>
                  </li>
                )}

                {/* Proofing: Submit Selection */}
                {currentSection === "proofing" && starredIds.size > 0 && !submitted && (
                  <li>
                    <button className="nav-link text-xs whitespace-nowrap font-bold"
                      style={{ ...display, border: "1px solid rgba(255,255,255,0.4)", padding: "4px 10px sm:padding: 5px 14px", background: "rgba(255,255,255,0.08)" }}
                      onClick={submitSelection} disabled={submitting} data-cursor="link">
                      {submitting ? "Submitting…" : `Submit (${starredIds.size}${gallery.maxSelections ? `/${gallery.maxSelections}` : ""})`}
                    </button>
                  </li>
                )}

                {/* Sidebar toggle */}
                <li>
                  <button className="ashade-hamburger p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setIsSidebarOpen(true)} data-cursor="link" title="Open menu">
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

      {/* ── Sticky Stage Workflow Subheader Bar with Live Countdown ── */}
      {currentSection === "proofing" ? (
        <div className="bg-neutral-900/95 border-b border-white/10 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs relative z-30 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-white font-semibold tracking-wide">
                Proofing &amp; Selection Phase
              </span>
              <span className="text-white/40 hidden sm:inline">•</span>
              <span className="text-white/60 text-[11px]">
                Star your favorites for retouching.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live Countdown & Progress Pill */}
            {gallery.maxSelections ? (
              <div className="flex items-center gap-2 bg-black/60 border border-white/15 px-3 py-1.5 rounded-xl font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/60">Selected:</span>
                  <strong className={
                    starredIds.size > gallery.maxSelections
                      ? "text-amber-400 font-bold"
                      : starredIds.size === gallery.maxSelections
                      ? "text-emerald-400 font-bold"
                      : "text-white"
                  }>
                    {starredIds.size}
                  </strong>
                  <span className="text-white/40">/ {gallery.maxSelections}</span>
                </div>

                <div className="h-3 w-px bg-white/20" />

                <span className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                  starredIds.size > gallery.maxSelections
                    ? "bg-amber-500/20 text-amber-300"
                    : starredIds.size === gallery.maxSelections
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/10 text-white/90"
                )}>
                  {starredIds.size > gallery.maxSelections
                    ? `${starredIds.size - gallery.maxSelections} Over Quota`
                    : starredIds.size === gallery.maxSelections
                    ? "Quota Reached ✓"
                    : `${gallery.maxSelections - starredIds.size} Remaining`}
                </span>
              </div>
            ) : (
              <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl font-mono text-xs text-white">
                Selected: <strong className="text-emerald-400">{starredIds.size}</strong> photos
              </div>
            )}

            {starredIds.size > 0 && !submitted && (
              <button
                onClick={submitSelection}
                disabled={submitting}
                className={cn(
                  "px-4 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer",
                  starredIds.size === gallery.maxSelections
                    ? "bg-emerald-400 hover:bg-emerald-300 text-black animate-pulse"
                    : starredIds.size > (gallery.maxSelections ?? Infinity)
                    ? "bg-amber-400 hover:bg-amber-300 text-black"
                    : "bg-white hover:bg-neutral-200 text-black"
                )}
              >
                <span>{submitting ? "Submitting…" : `Submit Selections (${starredIds.size})`}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/40 border-b border-amber-500/25 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs relative z-30">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-amber-200/90">
              <strong className="text-amber-400 font-semibold">Stage 2: Final Delivery Masters</strong> • Master retouched photos. Open any photo for Before/After split comparison, client fine-tuning sliders, and high-res downloads.
            </span>
          </div>
          {finalPhotos.length > 0 && gallery.downloadMode !== "none" && (
            <a
              href={`/api/galleries/${gallery.slug}/download?section=final`}
              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-1.5"
              download
            >
              <span>Download All Masters (ZIP)</span>
            </a>
          )}
        </div>
      )}

      {/* ── Gallery main scroll area ── */}
      <div ref={scrollContainerRef} className="ashade-gallery-main" style={{ position: "relative", zIndex: 2, minHeight: "100vh", overflowY: "auto" }}>
        <div className="pt-2 pb-12">

          {/* Mobile Phase Switcher */}
          <div className="flex sm:hidden items-center justify-center py-2 px-3 bg-black/60 border-b border-white/10">
            <div className="flex items-center bg-white/10 rounded-full p-0.5 border border-white/15 w-full max-w-xs">
              <button
                onClick={() => { setCurrentSection("proofing"); closeLightbox() }}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all text-center ${
                  currentSection === "proofing" ? "bg-white text-black shadow-sm" : "text-white/60"
                }`}
                style={display}
              >
                🌟 Proofing ({proofingPhotos.length})
              </button>
              <button
                onClick={() => { setCurrentSection("final"); closeLightbox() }}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all text-center ${
                  currentSection === "final" ? "bg-amber-400 text-black shadow-sm" : "text-white/60"
                }`}
                style={display}
              >
                ✨ Final ({finalPhotos.length})
              </button>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-between py-2 px-3 sm:px-8 md:px-12 mb-2 bg-black/40 border-b border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              {/* Mobile Layout Switcher */}
              <div className="flex md:hidden items-center bg-white/5 rounded-lg p-0.5 border border-white/10">
                {(["masonry", "ribbon"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => changeLayout(l)}
                    className={`px-2 py-1 text-[9px] font-bold uppercase rounded tracking-wider transition-colors ${layout === l ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}
                    style={display}
                  >
                    {l === "masonry" ? "Grid" : "Ribbon"}
                  </button>
                ))}
              </div>

              {/* Columns Selector */}
              {layout === "masonry" && (
                <div className="flex items-center gap-1">
                  <span className="text-white/30 text-[9px] uppercase tracking-widest mr-0.5 hidden xs:inline" style={display}>Cols</span>
                  {([2, 3, 4] as const).map(n => (
                    <button key={n} onClick={() => changeCols(n)} data-cursor="link"
                      className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded border text-[10px] font-bold transition-colors
                        ${masonryCols === n ? "border-white/60 text-white bg-white/15" : "border-white/12 text-white/30 hover:text-white/60 hover:border-white/30"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Animation presets */}
            <div className="flex items-center">
              {(["fade-up", "fade", "scale"] as const).map((a) => (
                <button key={a} onClick={() => changeAnim(a)} style={display} data-cursor="link"
                  className={`px-2 sm:px-2.5 py-1 text-[8px] sm:text-[9px] tracking-[0.12em] sm:tracking-[0.15em] uppercase transition-colors border-b ml-0.5 sm:ml-1
                    ${entryAnim === a ? "border-white/60 text-white font-bold" : "border-transparent text-white/30 hover:text-white/60"}`}>
                  {a === "fade-up" ? "Fade ↑" : a === "fade" ? "Fade" : "Zoom"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Empty State Handling for Sets ── */}
          {activePhotos.length === 0 && (
            <div className="py-24 px-6 text-center max-w-lg mx-auto space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold font-oswald uppercase text-white tracking-wider">
                {currentSection === "final" ? "Retouching In Progress" : "No Proofing Photos Yet"}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {currentSection === "final"
                  ? "The editor is currently finalizing your selected photos. Once retouched masters are uploaded to this collection, your Before/After split slider, fine-tuning tools, and high-res downloads will appear right here!"
                  : "Photos have not yet been uploaded to the proofing set for this collection."}
              </p>
              {currentSection === "final" && proofingPhotos.length > 0 && (
                <button
                  onClick={() => setCurrentSection("proofing")}
                  className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-all shadow-lg cursor-pointer"
                >
                  ← Return to Proofing Set ({proofingPhotos.length})
                </button>
              )}
            </div>
          )}

          {/* ── MASONRY ── */}
          {activePhotos.length > 0 && layout === "masonry" && (
            <div ref={gridRef} className="masonry-grid px-2" data-anim={entryAnim} style={{ columns: masonryCols }}>
              {activePhotos.map((photo, idx) => {
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
          {activePhotos.length > 0 && layout === "ribbon" && (
            <Ribbon photos={activePhotos} openLightbox={openLightbox} />
          )}

          {/* ── Infinite scroll sentinel ── */}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
          )}

        </div>
      </div>

      {/* Floating Bottom Limit Countdown Pill in Proofing Mode */}
      {currentSection === "proofing" && starredIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-2 px-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 shrink-0" />
            <span className="text-white">
              <strong>{starredIds.size}</strong>
              {gallery.maxSelections ? ` of ${gallery.maxSelections}` : " selected"}
            </span>
            {gallery.maxSelections && (
              <span className={
                starredIds.size > gallery.maxSelections
                  ? "text-amber-400 font-semibold"
                  : starredIds.size === gallery.maxSelections
                  ? "text-emerald-400 font-semibold"
                  : "text-white/60"
              }>
                ({starredIds.size > gallery.maxSelections
                  ? `${starredIds.size - gallery.maxSelections} over`
                  : starredIds.size === gallery.maxSelections
                  ? "quota complete"
                  : `${gallery.maxSelections - starredIds.size} left`})
              </span>
            )}
          </div>
          {!submitted && (
            <button
              onClick={submitSelection}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      )}

      {/* ── Direct Thumbnail Quick Comment Modal Dialog ── */}
      {quickCommentPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in-50 duration-200"
          onClick={() => setQuickCommentPhoto(null)}
        >
          <div
            className="bg-neutral-900 border border-white/20 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-900/90">
              <div className="flex items-center gap-3 min-w-0">
                {quickCommentPhoto.thumbKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl(quickCommentPhoto.thumbKey)!}
                    alt={quickCommentPhoto.filename}
                    loading="lazy"
                    className="h-10 w-10 rounded-lg object-cover shrink-0 border border-white/15"
                  />
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate" style={display}>
                    {quickCommentPhoto.filename}
                  </h4>
                  <p className="text-[11px] text-white/50">
                    Editing notes for the photographer
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQuickCommentPhoto(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-60 min-h-[100px] scrollbar-thin">
              {(commentMap[quickCommentPhoto.id]?.length ?? 0) === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-white/40">
                  <MessageCircle className="h-8 w-8 mb-2 stroke-1 text-white/20" />
                  <p className="text-xs">No notes yet on this photo.</p>
                  <p className="text-[11px] text-white/30 mt-0.5">Type specific retouching requests below.</p>
                </div>
              ) : (
                commentMap[quickCommentPhoto.id].map((c) => (
                  <div key={c.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        {c.authorName || "Client"}
                      </span>
                      <span className="text-white/40 text-[10px] font-mono">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed break-words">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* New Comment Input Form */}
            <form onSubmit={handleSendQuickComment} className="p-4 border-t border-white/10 bg-neutral-950/70 space-y-2.5">
              <input
                type="text"
                value={quickCommentAuthor}
                onChange={(e) => setQuickCommentAuthor(e.target.value)}
                placeholder="Your Name (Optional)"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/80 transition-colors"
              />

              <div className="relative">
                <textarea
                  value={quickCommentBody}
                  onChange={(e) => setQuickCommentBody(e.target.value)}
                  placeholder="e.g., Please brighten the shadows and soften the skin..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 pr-12 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/80 transition-colors resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendQuickComment(e)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!quickCommentBody.trim() || isSubmittingQuickComment}
                  className="absolute right-2 bottom-3 p-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-30 text-black transition-all cursor-pointer shadow-sm active:scale-95"
                  title="Send note"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      <Lightbox
        gallery={gallery}
        photos={activePhotos}
        activeIdx={activeIdx}
        isSlideshow={isSlideshow}
        setIsSlideshow={setIsSlideshow}
        goNext={goNext}
        goPrev={goPrev}
        closeLightbox={closeLightbox}
        starredIds={starredIds}
        commentMap={commentMap}
        submitComment={submitComment}
        toggleStar={toggleStar}
        clientSection={currentSection}
        proofingPhotos={proofingPhotos}
      />
    </div>
  )
}
