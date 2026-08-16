import { CurvePoint, DEFAULT_CURVE_POINTS } from "./tone-curve"

export interface CropRect {
  x: number // 0..100 percentage
  y: number // 0..100 percentage
  width: number // 0..100 percentage
  height: number // 0..100 percentage
}

export interface PhotoEditRecipe {
  // Light & Tonal Range
  exposure: number // -2.0 to +2.0 EV
  contrast: number // -100 to +100
  highlights: number // -100 to +100
  shadows: number // -100 to +100
  whites: number // -100 to +100
  blacks: number // -100 to +100
  curvePoints?: CurvePoint[]
  curveChannel?: "rgb" | "red" | "green" | "blue"

  // Color & White Balance
  temp: number // -100 (cool) to +100 (warm)
  tint: number // -100 (green) to +100 (magenta)
  vibrance: number // -100 to +100
  saturation: number // -100 to +100

  // Focus & Synthetic Optical Bokeh
  focusEnabled: boolean
  aperture: number // 1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 16.0
  focalPoint: { x: number; y: number } // 0..100 percentage
  blurRadius: number // 0 to 12 px
  clearZoneRadius: number // 15 to 70 percent
  subjectPop: number // 0 to 50

  // Framing, Crop & Orientation
  aspectRatio: "original" | "custom" | "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "3:2"
  cropBox: CropRect
  isCropCommitted?: boolean
  panOffset?: { x: number; y: number }
  zoom?: number
  straighten: number // -25 to +25 deg
  rotation?: number // 0, 90, 180, 270 deg
  flipH?: boolean
  flipV?: boolean

  // Texture, Sharpening & Effects
  sharpening?: number // 0 to 100
  sharpenRadius?: number // 0.5 to 3.0 px
  sharpenMasking?: number // 0 to 100%
  grain: number // 0 to 100
  vignette: number // -100 to +100
  clarity: number // 0 to 100
}

export const DEFAULT_CROP_BOX: CropRect = { x: 0, y: 0, width: 100, height: 100 }

export const DEFAULT_PHOTO_RECIPE: PhotoEditRecipe = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  curvePoints: [...DEFAULT_CURVE_POINTS],
  curveChannel: "rgb",
  temp: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  focusEnabled: false,
  aperture: 2.8,
  focalPoint: { x: 50, y: 35 },
  blurRadius: 3.5,
  clearZoneRadius: 38,
  subjectPop: 15,
  aspectRatio: "original",
  cropBox: { ...DEFAULT_CROP_BOX },
  panOffset: { x: 0, y: 0 },
  zoom: 1,
  straighten: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  sharpening: 15,
  sharpenRadius: 1.0,
  sharpenMasking: 20,
  grain: 0,
  vignette: 0,
  clarity: 0,
}

export interface CreativeVibeProposal {
  name: string
  tagline: string
  icon: string
  recipe: PhotoEditRecipe
}

export interface PhotoAIAnalysis {
  sceneType: string
  compositionScore: number
  lightingRating: string
  critique: string
  fixesApplied: string[]
  vibes: CreativeVibeProposal[]
}

export async function analyzeImageWithGemini(
  imageBase64: string,
  mimeType = "image/jpeg",
  apiKey?: string
): Promise<PhotoAIAnalysis | null> {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) return null

  const prompt = `You are a world-class professional master photographer and master photo colorist.
Analyze this photo in detail. Return a strict JSON response (no markdown, no code fences) with this exact schema:
{
  "sceneType": "e.g. Sunset Golden Hour Portrait / Moody Bridal Detail / High-Key Commercial Studio",
  "compositionScore": 92,
  "lightingRating": "e.g. Soft Diffused Sunset Light",
  "critique": "2-3 sentences explaining artistic strengths, lighting balance, and why certain exposure/depth adjustments were made.",
  "fixesApplied": ["Fix 1", "Fix 2", "Fix 3"],
  "vibes": [
    {
      "name": "True-to-Life Clean (Neutral)",
      "tagline": "Natural skin tones, 0% color cast, balanced highlights & subtle depth",
      "icon": "✨",
      "recipe": {
        "exposure": 0.1,
        "contrast": 8,
        "highlights": -16,
        "shadows": 18,
        "whites": 6,
        "blacks": -4,
        "temp": 0,
        "tint": 0,
        "vibrance": 12,
        "saturation": 2,
        "focusEnabled": true,
        "aperture": 2.0,
        "focalPoint": { "x": 50, "y": 35 },
        "blurRadius": 3.5,
        "clearZoneRadius": 38,
        "subjectPop": 15,
        "aspectRatio": "original",
        "cropBox": { "x": 0, "y": 0, "width": 100, "height": 100 },
        "straighten": 0,
        "sharpening": 20,
        "grain": 6,
        "vignette": -8,
        "clarity": 10
      }
    },
    {
      "name": "Warm Golden Sunset",
      "tagline": "Warm amber glow, lifted shadows & soft vintage film grain",
      "icon": "🌅",
      "recipe": {
        "exposure": 0.2,
        "contrast": 10,
        "highlights": -18,
        "shadows": 24,
        "whites": 8,
        "blacks": 4,
        "temp": 14,
        "tint": 4,
        "vibrance": 14,
        "saturation": 4,
        "focusEnabled": true,
        "aperture": 2.0,
        "focalPoint": { "x": 50, "y": 35 },
        "blurRadius": 4.0,
        "clearZoneRadius": 38,
        "subjectPop": 18,
        "aspectRatio": "original",
        "cropBox": { "x": 0, "y": 0, "width": 100, "height": 100 },
        "straighten": 0,
        "sharpening": 25,
        "grain": 14,
        "vignette": -12,
        "clarity": 12
      }
    },
    {
      "name": "Cool Nordic Editorial",
      "tagline": "Clean cool shadows, crisp whites, modern high-end editorial look",
      "icon": "❄️",
      "recipe": {
        "exposure": 0.15,
        "contrast": 14,
        "highlights": -22,
        "shadows": 16,
        "whites": 10,
        "blacks": -6,
        "temp": -8,
        "tint": 2,
        "vibrance": 10,
        "saturation": -4,
        "focusEnabled": true,
        "aperture": 2.8,
        "focalPoint": { "x": 50, "y": 35 },
        "blurRadius": 3.0,
        "clearZoneRadius": 38,
        "subjectPop": 18,
        "aspectRatio": "original",
        "cropBox": { "x": 0, "y": 0, "width": 100, "height": 100 },
        "straighten": 0,
        "sharpening": 30,
        "grain": 8,
        "vignette": -14,
        "clarity": 16
      }
    }
  ]
}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      }
    )

    if (!res.ok) return null
    const data = await res.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) return null
    return JSON.parse(content) as PhotoAIAnalysis
  } catch {
    return null
  }
}
