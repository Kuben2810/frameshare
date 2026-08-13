"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { InferSelectModel } from "drizzle-orm"
import type { photos } from "@/db/schema"
import { WebGLDistortion } from "@/components/webgl-distortion"

type Photo = InferSelectModel<typeof photos>

function imgUrl(key: string | null | undefined) {
  if (!key) return null
  return `/api/s3/${key}`
}

function ribbonAspect(photo: Photo) {
  const ar = (photo.width && photo.height) ? photo.width / photo.height : 1.5
  return ar >= 1 ? "aspect-landscape" : "aspect-portrait"
}

export function Ribbon({
  photos,
  openLightbox,
}: {
  photos: Photo[]
  openLightbox: (idx: number) => void
}) {
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
    updateRibbonMax()
    window.addEventListener("resize", updateRibbonMax)
    return () => window.removeEventListener("resize", updateRibbonMax)
  }, [updateRibbonMax, photos])

  useEffect(() => {
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
  }, [])

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

  return (
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
  )
}
