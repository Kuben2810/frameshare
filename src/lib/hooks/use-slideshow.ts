"use client"

import { useState, useEffect, useRef, useCallback } from "react"

const SLIDESHOW_INTERVAL = 4000

export function useSlideshow(photoCount: number) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [navDir, setNavDir] = useState<"right" | "left">("right")
  const [isSlideshow, setIsSlideshow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goNext = useCallback(() => {
    setNavDir("right")
    setActiveIdx((i) => {
      if (i === null || i >= photoCount - 1) { setIsSlideshow(false); return i }
      return i + 1
    })
  }, [photoCount])

  const goPrev = useCallback(() => {
    setNavDir("left")
    setActiveIdx((i) => Math.max(0, (i ?? 0) - 1))
  }, [])

  useEffect(() => {
    if (!isSlideshow || activeIdx === null) return
    timerRef.current = setTimeout(goNext, SLIDESHOW_INTERVAL)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isSlideshow, activeIdx, goNext])

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

  function closeLightbox() {
    setIsSlideshow(false)
    setActiveIdx(null)
  }

  return { activeIdx, navDir, isSlideshow, setIsSlideshow, openLightbox, closeLightbox, goNext, goPrev }
}
