"use client"

import { useEffect, useRef, useState } from "react"

export type CursorState = "normal" | "zoom" | "close" | "slider" | "link"

export function AshadeCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<CursorState>("normal")
  const [visible, setVisible] = useState(false)

  const mousePos = useRef({ x: -100, y: -100 })
  const ringPos = useRef({ x: -100, y: -100 })

  useEffect(() => {
    if ("ontouchstart" in window) return

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      setVisible(true)
      const target = (e.target as Element).closest("[data-cursor]")
      if (target) {
        setState(target.getAttribute("data-cursor") as CursorState)
      } else if ((e.target as Element).closest("a, button, input, textarea, select")) {
        setState("link")
      } else {
        setState("normal")
      }
    }
    const onLeave = () => setVisible(false)
    const onEnter = () => setVisible(true)

    window.addEventListener("mousemove", onMove)
    document.addEventListener("mouseleave", onLeave)
    document.addEventListener("mouseenter", onEnter)

    let rafId: number
    const tick = () => {
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.18
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.18
      if (dotRef.current)
        dotRef.current.style.transform = `translate3d(${mousePos.current.x}px,${mousePos.current.y}px,0)`
      if (ringRef.current)
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px,${ringPos.current.y}px,0)`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
      document.removeEventListener("mouseenter", onEnter)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className={`ashade-cursor-wrap ${visible ? "is-visible" : ""} state-${state}`}>
      <div ref={dotRef} className="ashade-cursor-dot" />
      <div ref={ringRef} className="ashade-cursor-ring">
        <span className="ring-circle" />
        {state === "zoom" && <span className="cursor-label">Zoom</span>}
        {state === "close" && <span className="cursor-label">Close</span>}
        {state === "slider" && (
          <span className="cursor-arrows">
            <svg viewBox="0 0 10 18" width="10" height="18"><path d="M2.25-17.812l1.125,1.125L-4.359-9,3.375-1.312,2.25-.187-6-8.437-6.469-9-6-9.562Z" transform="translate(6.469 17.813)" fill="#fff"/></svg>
            <svg viewBox="0 0 10 18" width="10" height="18"><path d="M-2.25-17.812,6-9.562,6.469-9,6-8.437-2.25-.187-3.375-1.312,4.359-9l-7.734-7.687Z" transform="translate(3.375 17.813)" fill="#fff"/></svg>
          </span>
        )}
      </div>
    </div>
  )
}
