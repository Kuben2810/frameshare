"use client"

import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
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
    useSlideshow(photos.length)

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
  }, [photos, layout])

  function changeLayout(l: Layout) { setLayout(l); localStorage.setItem("gallery-layout", l) }
  function changeAnim(a: EntryAnim) { setEntryAnim(a); localStorage.setItem("gallery-entry-anim", a) }
  function changeCols(n: 2|3|4) { setMasonryCols(n); localStorage.setItem("gallery-masonry-cols", String(n)) }

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
        {/* Gradient hover overlay */}
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
          <a className="ashade-logo min-w-0 pr-3" href="#" onClick={(e) => e.preventDefault()} data-cursor="link">
            {gallery.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" className="h-7 w-auto object-contain" />
            ) : (
              <>
                <span className="ashade-logo-text truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
                  {gallery.name}
                </span>
                <span className="ashade-logo-tag">Photography Gallery</span>
              </>
            )}
          </a>

          {/* Nav */}
          <div className="ashade-nav-block shrink-0">
            <nav className="ashade-nav">
              <ul className="main-menu">
                {/* Layout pickers (desktop/tablet) */}
                {(["masonry", "ribbon"] as const).map((l) => (
                  <li key={l} className={`hidden sm:inline-block ${layout === l ? "is-active" : ""}`}>
                    <button className="nav-link" style={display} onClick={() => changeLayout(l)} data-cursor="link">
                      {l === "masonry" ? "Mason" : "Ribbon"}
                    </button>
                  </li>
                ))}

                {/* Slideshow (desktop/tablet) */}
                <li className="hidden sm:inline-block">
                  <button className="nav-link" style={display} onClick={() => openLightbox(0, true)} data-cursor="link">
                    Slideshow
                  </button>
                </li>

                {/* Submit (Always visible when client selects) */}
                {starredIds.size > 0 && !submitted && (
                  <li>
                    <button className="nav-link text-xs whitespace-nowrap font-bold"
                      style={{ ...display, border: "1px solid rgba(255,255,255,0.4)", padding: "4px 10px sm:padding: 5px 14px", background: "rgba(255,255,255,0.08)" }}
                      onClick={submitSelection} disabled={submitting} data-cursor="link">
                      {submitting ? "Submitting…" : `Submit (${starredIds.size})`}
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
        <div style={{ paddingTop: 84 }}>

          {/* Controls bar */}
          <div className="flex items-center justify-between py-2 px-3 sm:px-8 md:px-12 mb-0.5">
            {layout === "masonry" ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-white/30 text-[9px] uppercase tracking-widest mr-0.5" style={display}>Cols</span>
                {([2, 3, 4] as const).map(n => (
                  <button key={n} onClick={() => changeCols(n)} data-cursor="link"
                    className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded border text-[10px] font-bold transition-colors
                      ${masonryCols === n ? "border-white/60 text-white" : "border-white/12 text-white/25 hover:text-white/50 hover:border-white/30"}`}>
                    {n}
                  </button>
                ))}
              </div>
            ) : <div />}
            <div className="flex items-center">
              {(["fade-up", "fade", "scale"] as const).map((a) => (
                <button key={a} onClick={() => changeAnim(a)} style={display} data-cursor="link"
                  className={`px-2 sm:px-2.5 py-1 text-[8px] sm:text-[9px] tracking-[0.12em] sm:tracking-[0.15em] uppercase transition-colors border-b ml-0.5 sm:ml-1
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
            <Ribbon photos={photos} openLightbox={openLightbox} />
          )}

        </div>
      </div>

      {/* ── Lightbox ── */}
      <Lightbox
        gallery={gallery}
        photos={photos}
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
      />
    </div>
  )
}
