/**
 * Helper to compute 32-sample LUT table values for SVG feComponentTransfer
 * taking into account Exposure, Contrast, Highlights, Shadows, Whites, Blacks,
 * and custom Tone Curve control points.
 */

export interface CurvePoint {
  x: number // 0..100
  y: number // 0..100
}

export interface ChannelCurves {
  rgb: CurvePoint[]
  red: CurvePoint[]
  green: CurvePoint[]
  blue: CurvePoint[]
}

export const DEFAULT_CURVE_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 25, y: 25 },
  { x: 50, y: 50 },
  { x: 75, y: 75 },
  { x: 100, y: 100 },
]

export const CURVE_PRESETS: { name: string; points: CurvePoint[] }[] = [
  {
    name: "Linear (Default)",
    points: [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      { x: 50, y: 50 },
      { x: 75, y: 75 },
      { x: 100, y: 100 },
    ],
  },
  {
    name: "Soft Contrast",
    points: [
      { x: 0, y: 0 },
      { x: 25, y: 20 },
      { x: 50, y: 50 },
      { x: 75, y: 80 },
      { x: 100, y: 100 },
    ],
  },
  {
    name: "Medium Punch (S-Curve)",
    points: [
      { x: 0, y: 0 },
      { x: 25, y: 15 },
      { x: 50, y: 50 },
      { x: 75, y: 85 },
      { x: 100, y: 100 },
    ],
  },
  {
    name: "Matte Film Lift",
    points: [
      { x: 0, y: 10 },
      { x: 25, y: 26 },
      { x: 50, y: 50 },
      { x: 75, y: 76 },
      { x: 100, y: 94 },
    ],
  },
  {
    name: "High Key Bright",
    points: [
      { x: 0, y: 0 },
      { x: 25, y: 35 },
      { x: 50, y: 62 },
      { x: 75, y: 86 },
      { x: 100, y: 100 },
    ],
  },
]

/**
 * Evaluates a Catmull-Rom / Monotone cubic spline given sorted points at x (0..1)
 */
export function evaluateSpline(points: CurvePoint[], xNorm: number): number {
  const pts = points.map((p) => ({ x: p.x / 100, y: p.y / 100 }))

  if (xNorm <= pts[0].x) return pts[0].y
  if (xNorm >= pts[pts.length - 1].x) return pts[pts.length - 1].y

  // Find surrounding segment
  let i = 0
  while (i < pts.length - 1 && pts[i + 1].x < xNorm) {
    i++
  }

  const p0 = pts[Math.max(0, i - 1)]
  const p1 = pts[i]
  const p2 = pts[i + 1]
  const p3 = pts[Math.min(pts.length - 1, i + 2)]

  const dx = p2.x - p1.x
  if (dx === 0) return p1.y

  const t = (xNorm - p1.x) / dx
  const t2 = t * t
  const t3 = t2 * t

  // Catmull-Rom interpolation
  const c0 = -0.5 * t3 + t2 - 0.5 * t
  const c1 = 1.5 * t3 - 2.5 * t2 + 1.0
  const c2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t
  const c3 = 0.5 * t3 - 0.5 * t2

  const val = c0 * p0.y + c1 * p1.y + c2 * p2.y + c3 * p3.y
  return Math.max(0, Math.min(1, val))
}

/**
 * Builds SVG tableValues string (32 samples from 0 to 1) incorporating
 * sliders (highlights, shadows, whites, blacks, contrast) and tone curve points.
 */
export function generateToneLutString(params: {
  points?: CurvePoint[]
  highlights: number // -100 to +100
  shadows: number // -100 to +100
  whites: number // -100 to +100
  blacks: number // -100 to +100
  contrast?: number // -100 to +100
  channelBoost?: number // e.g. color temp/tint per channel
}): string {
  const { points = DEFAULT_CURVE_POINTS, highlights, shadows, whites, blacks, contrast = 0, channelBoost = 0 } = params

  const SAMPLES = 32
  const values: number[] = []

  const hlFactor = highlights * 0.003
  const shFactor = shadows * 0.003
  const whFactor = whites * 0.002
  const blFactor = blacks * 0.002
  const contFactor = contrast * 0.004

  for (let i = 0; i < SAMPLES; i++) {
    const x = i / (SAMPLES - 1)

    // 1. Evaluate user curve
    let y = evaluateSpline(points, x)

    // 2. Apply Shadows (affects lower quadrant 0..0.6)
    if (x <= 0.65) {
      const weight = Math.sin((x / 0.65) * Math.PI) // Peak at mid-shadows
      y += shFactor * weight
    }

    // 3. Apply Highlights (affects upper quadrant 0.35..1.0)
    if (x >= 0.35) {
      const weight = Math.sin(((x - 0.35) / 0.65) * Math.PI) // Peak at mid-highlights
      y += hlFactor * weight
    }

    // 4. Apply Blacks (affects 0..0.35)
    if (x <= 0.35) {
      const weight = (0.35 - x) / 0.35
      y += blFactor * weight
    }

    // 5. Apply Whites (affects 0.65..1.0)
    if (x >= 0.65) {
      const weight = (x - 0.65) / 0.35
      y += whFactor * weight
    }

    // 6. Apply Contrast
    if (contFactor !== 0) {
      y = (y - 0.5) * (1 + contFactor) + 0.5
    }

    // 7. Channel boost
    if (channelBoost !== 0) {
      y += channelBoost * 0.002
    }

    // Clamp 0..1 with 3 decimal precision
    const clamped = Math.max(0, Math.min(1, y))
    values.push(parseFloat(clamped.toFixed(3)))
  }

  return values.join(" ")
}
