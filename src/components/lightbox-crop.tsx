"use client"
import { useState, useEffect, useRef } from "react"
import { X, Download } from "lucide-react"

type Crop = { x: number; y: number; w: number; h: number }
type Handle = "move" | "nw" | "ne" | "sw" | "se"
type Drag = {
  handle: Handle
  startMouse: { x: number; y: number }
  startCrop: Crop
  ir: { left: number; top: number; width: number; height: number }
}

const MIN = 0.05
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function computeImgRect(el: HTMLDivElement, nw: number, nh: number) {
  const { width: cw, height: ch } = el.getBoundingClientRect()
  if (!cw || !ch || !nw || !nh) return { left: 0, top: 0, width: cw, height: ch }
  const ir = nw / nh, cr = cw / ch
  if (ir > cr) {
    const w = cw, h = cw / ir
    return { left: 0, top: (ch - h) / 2, width: w, height: h }
  }
  const h = ch, w = ch * ir
  return { left: (cw - w) / 2, top: 0, width: w, height: h }
}

export function LightboxCrop({
  imageUrl,
  naturalWidth,
  naturalHeight,
  filename,
  onClose,
}: {
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  filename: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [crop, setCrop] = useState<Crop>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const [imgRect, setImgRect] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setImgRect(computeImgRect(el, naturalWidth, naturalHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [naturalWidth, naturalHeight])

  function startDrag(handle: Handle, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const ir = containerRef.current
      ? computeImgRect(containerRef.current, naturalWidth, naturalHeight)
      : imgRect
    setDrag({ handle, startMouse: { x: e.clientX, y: e.clientY }, startCrop: { ...crop }, ir })
  }

  useEffect(() => {
    if (!drag) return
    const { ir } = drag
    function onMove(e: MouseEvent) {
      const dx = (e.clientX - drag!.startMouse.x) / ir.width
      const dy = (e.clientY - drag!.startMouse.y) / ir.height
      setCrop(() => {
        let { x, y, w, h } = drag!.startCrop
        switch (drag!.handle) {
          case "move":
            x = clamp(x + dx, 0, 1 - w)
            y = clamp(y + dy, 0, 1 - h)
            break
          case "nw": { const nx = clamp(x + dx, 0, x + w - MIN), ny = clamp(y + dy, 0, y + h - MIN); w -= nx - x; h -= ny - y; x = nx; y = ny; break }
          case "ne": { const ny = clamp(y + dy, 0, y + h - MIN); h -= ny - y; y = ny; w = clamp(w + dx, MIN, 1 - x); break }
          case "sw": { const nx = clamp(x + dx, 0, x + w - MIN); w -= nx - x; x = nx; h = clamp(h + dy, MIN, 1 - y); break }
          case "se": w = clamp(w + dx, MIN, 1 - x); h = clamp(h + dy, MIN, 1 - y); break
        }
        return { x, y, w, h }
      })
    }
    function onUp() { setDrag(null) }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [drag])

  async function doExport() {
    setExporting(true)
    try {
      const img = new Image()
      img.src = imageUrl
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("img load")) })
      const sw = Math.round(img.naturalWidth * crop.w)
      const sh = Math.round(img.naturalHeight * crop.h)
      const canvas = document.createElement("canvas")
      canvas.width = sw; canvas.height = sh
      canvas.getContext("2d")!.drawImage(
        img,
        Math.round(img.naturalWidth * crop.x), Math.round(img.naturalHeight * crop.y), sw, sh,
        0, 0, sw, sh
      )
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = Object.assign(document.createElement("a"), { href: url, download: `crop_${filename}` })
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 100)
      }, "image/jpeg", 0.92)
    } finally {
      setExporting(false)
    }
  }

  const cx = imgRect.left + crop.x * imgRect.width
  const cy = imgRect.top  + crop.y * imgRect.height
  const cw = crop.w * imgRect.width
  const ch = crop.h * imgRect.height
  const H = 10 // handle px size

  const corners: { id: Handle; s: React.CSSProperties }[] = [
    { id: "nw", s: { left: -H/2,  top:    -H/2,  cursor: "nw-resize" } },
    { id: "ne", s: { right: -H/2, top:    -H/2,  cursor: "ne-resize" } },
    { id: "sw", s: { left: -H/2,  bottom: -H/2,  cursor: "sw-resize" } },
    { id: "se", s: { right: -H/2, bottom: -H/2,  cursor: "se-resize" } },
  ]

  return (
    <div ref={containerRef} className="absolute inset-0 select-none">
      {/* Dimmed overlay with crop hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="crop-hole">
            <rect width="100%" height="100%" fill="white" />
            <rect x={cx} y={cy} width={cw} height={ch} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#crop-hole)" />
      </svg>

      {/* Crop rect + handles */}
      <div
        onMouseDown={(e) => startDrag("move", e)}
        style={{ position: "absolute", left: cx, top: cy, width: cw, height: ch, cursor: "move", border: "1.5px solid white", boxSizing: "border-box" }}
      >
        {/* Rule-of-thirds lines */}
        {[1/3, 2/3].map(f => (
          <div key={`g${f}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: `${f*100}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.25)" }} />
            <div style={{ position: "absolute", top: `${f*100}%`, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.25)" }} />
          </div>
        ))}
        {corners.map(({ id, s }) => (
          <div key={id} onMouseDown={(e) => startDrag(id, e)}
            style={{ position: "absolute", width: H, height: H, background: "white", borderRadius: 2, ...s }} />
        ))}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        <span className="text-white/60 text-xs tabular-nums">
          {Math.round(crop.w * naturalWidth)} × {Math.round(crop.h * naturalHeight)}px
        </span>
        <button onClick={doExport} disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors">
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export crop"}
        </button>
        <button onClick={onClose}
          className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors">
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  )
}
