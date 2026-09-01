"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { CurvePoint, DEFAULT_CURVE_POINTS, CURVE_PRESETS, evaluateSpline } from "@/lib/tone-curve"
import { RotateCcw, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToneCurveEditorProps {
  points: CurvePoint[]
  onChange: (newPoints: CurvePoint[]) => void
  channel: "rgb" | "red" | "green" | "blue"
  onChannelChange?: (channel: "rgb" | "red" | "green" | "blue") => void
}

export function ToneCurveEditor({
  points = DEFAULT_CURVE_POINTS,
  onChange,
  channel = "rgb",
  onChannelChange,
}: ToneCurveEditorProps) {
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null)
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pointsRef = useRef<CurvePoint[]>(points)
  pointsRef.current = points

  const activeIdxRef = useRef<number | null>(null)
  activeIdxRef.current = activePointIdx

  // Construct SVG spline path
  const SAMPLES = 64
  const pathCoords: string[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const x = i / SAMPLES
    const y = evaluateSpline(points, x)
    const svgX = x * 200
    const svgY = (1 - y) * 200
    pathCoords.push(`${i === 0 ? "M" : "L"} ${svgX.toFixed(1)} ${svgY.toFixed(1)}`)
  }
  const curvePath = pathCoords.join(" ")
  const areaPath = `${curvePath} L 200 200 L 0 200 Z`

  // Update point position from normalized coordinates (0..100)
  const updatePointPosition = useCallback(
    (idx: number, clientX: number, clientY: number) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const rawX = (clientX - rect.left) / rect.width
      const rawY = 1 - (clientY - rect.top) / rect.height

      const clampedY = Math.max(0, Math.min(100, Math.round(rawY * 100)))

      const currentPts = [...pointsRef.current]
      if (idx === 0) {
        currentPts[0] = { x: 0, y: clampedY }
      } else if (idx === currentPts.length - 1) {
        currentPts[currentPts.length - 1] = { x: 100, y: clampedY }
      } else {
        const minX = (currentPts[idx - 1]?.x ?? 0) + 4
        const maxX = (currentPts[idx + 1]?.x ?? 100) - 4
        const clampedX = Math.max(minX, Math.min(maxX, Math.round(rawX * 100)))
        currentPts[idx] = { x: clampedX, y: clampedY }
      }

      onChange(currentPts)
    },
    [onChange]
  )

  // Find nearest point when clicking anywhere on the graph
  const handleGraphPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    const clickY = (1 - (e.clientY - rect.top) / rect.height) * 100

    // Find closest control point
    let closestIdx = 0
    let minDistance = Infinity

    points.forEach((pt, idx) => {
      const dist = Math.hypot(pt.x - clickX, pt.y - clickY)
      if (dist < minDistance) {
        minDistance = dist
        closestIdx = idx
      }
    })

    setActivePointIdx(closestIdx)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // fallback if capture unsupported
    }
    updatePointPosition(closestIdx, e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeIdxRef.current !== null) {
      e.preventDefault()
      updatePointPosition(activeIdxRef.current, e.clientX, e.clientY)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setActivePointIdx(null)
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
  }

  // Global window backup in case pointer leaves element
  useEffect(() => {
    function handleGlobalMove(e: MouseEvent) {
      if (activeIdxRef.current !== null) {
        updatePointPosition(activeIdxRef.current, e.clientX, e.clientY)
      }
    }
    function handleGlobalUp() {
      if (activeIdxRef.current !== null) {
        setActivePointIdx(null)
      }
    }

    window.addEventListener("mousemove", handleGlobalMove)
    window.addEventListener("mouseup", handleGlobalUp)
    return () => {
      window.removeEventListener("mousemove", handleGlobalMove)
      window.removeEventListener("mouseup", handleGlobalUp)
    }
  }, [updatePointPosition])

  const channelColor =
    channel === "red"
      ? "#ef4444"
      : channel === "green"
      ? "#22c55e"
      : channel === "blue"
      ? "#3b82f6"
      : "#f59e0b"

  const activePoint = activePointIdx !== null ? points[activePointIdx] : null

  return (
    <div className="space-y-3 rounded-xl bg-neutral-900/90 border border-neutral-800 p-3.5 select-none shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-bold font-oswald uppercase tracking-wider text-white">
            Tone Curve
          </span>
        </div>

        {/* Channel Selector */}
        {onChannelChange && (
          <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-neutral-800 text-[10px]">
            {(["rgb", "red", "green", "blue"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => onChannelChange(ch)}
                className={cn(
                  "px-2 py-0.5 rounded font-bold uppercase transition-all cursor-pointer",
                  channel === ch
                    ? ch === "red"
                      ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-xs"
                      : ch === "green"
                      ? "bg-green-500/20 text-green-400 border border-green-500/40 shadow-xs"
                      : ch === "blue"
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-xs"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs"
                    : "text-neutral-400 hover:text-white"
                )}
              >
                {ch === "rgb" ? "RGB" : ch[0].toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Curve SVG Graph Canvas (With Pointer Capture & Large Hit Area) ── */}
      <div className="relative w-full aspect-square max-w-[250px] mx-auto bg-black/90 rounded-xl overflow-hidden border border-neutral-800 shadow-inner flex items-center justify-center touch-none">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          onPointerDown={handleGraphPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-crosshair overflow-visible touch-none"
        >
          <defs>
            <linearGradient id={`curve-grad-${channel}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={channelColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={channelColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines (4x4 quarters) */}
          <line x1="50" y1="0" x2="50" y2="200" stroke="#262626" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="100" y1="0" x2="100" y2="200" stroke="#333333" strokeWidth="1" />
          <line x1="150" y1="0" x2="150" y2="200" stroke="#262626" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="200" y2="50" stroke="#262626" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#333333" strokeWidth="1" />
          <line x1="0" y1="150" x2="200" y2="150" stroke="#262626" strokeWidth="1" strokeDasharray="2,2" />

          {/* 45-degree Linear Reference Line */}
          <line x1="0" y1="200" x2="200" y2="0" stroke="#404040" strokeWidth="1" strokeDasharray="3,3" />

          {/* Fill under curve */}
          <path d={areaPath} fill={`url(#curve-grad-${channel})`} />

          {/* Spline Curve Line */}
          <path d={curvePath} fill="none" stroke={channelColor} strokeWidth="2.5" strokeLinecap="round" />

          {/* Interactive Control Points */}
          {points.map((pt, idx) => {
            const cx = (pt.x / 100) * 200
            const cy = (1 - pt.y / 100) * 200
            const isSelected = activePointIdx === idx
            const isHovered = hoveredPointIdx === idx

            return (
              <g
                key={idx}
                onPointerEnter={() => setHoveredPointIdx(idx)}
                onPointerLeave={() => setHoveredPointIdx(null)}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* Generous Invisible Hit Circle (36px wide target) */}
                <circle cx={cx} cy={cy} r={18} fill="transparent" />

                {/* Glow ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 10 : isHovered ? 8 : 6}
                  fill={channelColor}
                  opacity={isSelected ? 0.45 : isHovered ? 0.3 : 0.15}
                  className="transition-all pointer-events-none"
                />

                {/* Center dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5.5 : 4.5}
                  fill="#ffffff"
                  stroke={channelColor}
                  strokeWidth="2"
                  className="transition-transform pointer-events-none shadow-md"
                />
              </g>
            )
          })}
        </svg>

        {/* Labels & Live Value Readout */}
        <span className="absolute bottom-1.5 left-2 text-[9px] font-mono text-neutral-500 pointer-events-none">
          Shadows
        </span>
        <span className="absolute top-1.5 right-2 text-[9px] font-mono text-neutral-500 pointer-events-none">
          Highlights
        </span>

        {/* Live Coordinate Badge during drag */}
        {activePoint && (
          <div className="absolute top-2 left-2 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded border border-amber-400/40 text-[10px] font-mono text-amber-400 pointer-events-none shadow-lg">
            In: {activePoint.x} • Out: {activePoint.y}
          </div>
        )}
      </div>

      {/* ── Preset Curves ── */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
          <span>Curve Presets</span>
          <button
            onClick={() => onChange(DEFAULT_CURVE_POINTS)}
            className="text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Linear Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[10px]">
          {CURVE_PRESETS.slice(1).map((preset) => (
            <button
              key={preset.name}
              onClick={() => onChange([...preset.points])}
              className="py-1 px-2 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all text-left truncate cursor-pointer font-medium"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
