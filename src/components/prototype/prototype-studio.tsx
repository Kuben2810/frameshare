"use client"

import { useState, useRef, useEffect, useCallback, useId } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Sliders,
  Crop,
  Aperture,
  Palette,
  Sun,
  Eye,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Check,
  Download,
  Share2,
  ChevronRight,
  ChevronLeft,
  Star,
  CheckCircle2,
  Layers,
  Wand2,
  Maximize2,
  ArrowLeft,
  Info,
  Flame,
  Camera,
  Film,
  Grid3X3,
  SplitSquareVertical,
  Undo2,
  Redo2,
  Focus,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  FileUp,
  Image as ImageIcon,
  Key,
  Scan,
  Zap,
  Move,
  ZoomIn,
  Smile,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  FolderUp,
  Folder,
  Activity,
  CheckCheck,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { decodePhotoOrRawFile, isRawFile } from "@/lib/raw-preview-extractor"
import { ToneCurveEditor } from "./tone-curve-editor"
import { CurvePoint, DEFAULT_CURVE_POINTS, generateToneLutString } from "@/lib/tone-curve"

// ── Types ──────────────────────────────────────────────────────────────────
export interface SamplePhoto {
  id: string
  title: string
  category: string
  clientNote: string
  stars: number
  src: string
  aspectRatio: string
  isUserUploaded?: boolean
  isRaw?: boolean
  defaultFocalPoint: { x: number; y: number } // 0..100 percentage
  detectedSubjectBox?: { x: number; y: number; w: number; h: number }
  aiSource?: "gemini" | "heuristic"
  aiAnalysis: {
    sceneType: string
    sceneCategory: "Portrait" | "Landscape" | "Editorial" | "Detail"
    lightingRating: "Slight Underexposure" | "Balanced Daylight" | "High Contrast Studio" | "Soft Window Diffusion"
    critique: string
    bestPracticeFixes: string[]
    recommendedCrop: string
    recommendedAperture: string
    vibes: {
      name: string
      tagline: string
      icon: string
      recipe: EditRecipe
    }[]
  }
}

export interface CropRect {
  x: number // 0..100%
  y: number // 0..100%
  width: number // 0..100%
  height: number // 0..100%
}

export interface EditRecipe {
  // Light & Tonal Curve
  exposure: number // -2.0 to +2.0 EV
  contrast: number // -100 to +100
  highlights: number // -100 to +100
  shadows: number // -100 to +100
  whites: number // -100 to +100
  blacks: number // -100 to +100
  curvePoints: CurvePoint[]
  curveChannel?: "rgb" | "red" | "green" | "blue"

  // Color
  temp: number // -100 (cool) to +100 (warm)
  tint: number // -100 (green) to +100 (magenta)
  vibrance: number // -100 to +100
  saturation: number // -100 to +100

  // Focus & Synthetic Optical Bokeh
  focusEnabled: boolean
  aperture: number // f/1.4 = 1.4, f/2.0 = 2, f/2.8 = 2.8, f/4 = 4, f/5.6 = 5.6, f/8 = 8, f/16 = 16
  focalPoint: { x: number; y: number } // percentage 0..100
  blurRadius: number // 0 to 12 px (optical realistic scale)
  clearZoneRadius: number // 15 to 65 percent (protects whole subject head & body)
  subjectPop: number // 0 to 50 (subtle luminance contrast pop)

  // Crop, Framing & Interactive Pan
  aspectRatio: "original" | "custom" | "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "3:2"
  cropBox: CropRect
  isCropCommitted?: boolean
  panOffset: { x: number; y: number } // -50% to +50% interactive pan
  zoom: number // 1.0 to 2.0x
  straighten: number // -25 to +25 deg
  rotation?: number // 0, 90, 180, 270 deg
  flipH?: boolean
  flipV?: boolean

  // Texture, Sharpening & Effects
  sharpening?: number // 0 to 100 (optical unsharp mask)
  sharpenRadius?: number // 0.5 to 3.0 px
  sharpenMasking?: number // 0 to 100% (edge threshold)
  grain: number // 0 to 100
  vignette: number // -100 to +100
  clarity: number // 0 to 100
}

const DEFAULT_CROP_BOX: CropRect = { x: 0, y: 0, width: 100, height: 100 }

// ── Default Preset Photos ──────────────────────────────────────────────────
const DEFAULT_PHOTOS: SamplePhoto[] = [
  {
    id: "proto-1",
    title: "Elena • Meadow Portrait",
    category: "Sample Starred #1",
    clientNote: "“Love this shot! Can we balance the light on my top and give a soft portrait look?”",
    stars: 3,
    src: "/prototype/portrait.jpg",
    aspectRatio: "3:2",
    defaultFocalPoint: { x: 62, y: 32 },
    detectedSubjectBox: { x: 0.42, y: 0.12, w: 0.46, h: 0.8 },
    aiSource: "heuristic",
    aiAnalysis: {
      sceneType: "Outdoor Natural Light Portrait",
      sceneCategory: "Portrait",
      lightingRating: "Balanced Daylight",
      critique:
        "Beautiful natural lighting with backlight rim light. Subject face is cleanly exposed. Recommended edit lifts shadow detail by +0.2EV while preserving true skin tones, applying a subtle f/2.0 optical roll-off with generous subject protection.",
      bestPracticeFixes: [
        "+0.25 EV Exposure recovery on subject midtones",
        "Neutral true-to-life white balance preservation",
        "Gentle highlight roll-off (-16) to preserve linen textures",
        "Subtle f/2.0 depth-of-field with full head & torso clear zone",
      ],
      recommendedCrop: "Original Full Frame / 4:5 with Headroom",
      recommendedAperture: "f/2.0 Subtle Optical Bokeh",
      vibes: [
        {
          name: "True-to-Life Clean",
          tagline: "Natural skin tones, neutral white balance, crisp balanced exposure",
          icon: "✨",
          recipe: {
            exposure: 0.2,
            contrast: 8,
            highlights: -16,
            shadows: 22,
            whites: 5,
            blacks: -5,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: 12,
            saturation: 4,
            focusEnabled: true,
            aperture: 2.0,
            focalPoint: { x: 62, y: 32 },
            blurRadius: 4.5,
            clearZoneRadius: 36,
            subjectPop: 15,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 8,
            vignette: -10,
            clarity: 10,
          },
        },
        {
          name: "Warm Editorial Film",
          tagline: "Subtle Kodak warmth, gentle shadow lift, soft ISO 200 grain",
          icon: "🎞️",
          recipe: {
            exposure: 0.25,
            contrast: 10,
            highlights: -20,
            shadows: 25,
            whites: 5,
            blacks: 6,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 12,
            tint: 4,
            vibrance: 14,
            saturation: 0,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 62, y: 32 },
            blurRadius: 3.5,
            clearZoneRadius: 38,
            subjectPop: 15,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 16,
            vignette: -12,
            clarity: 12,
          },
        },
        {
          name: "Monochrome Fine Art",
          tagline: "Timeless black & white with smooth tonal gradation and clean blacks",
          icon: "🖤",
          recipe: {
            exposure: 0.15,
            contrast: 22,
            highlights: -10,
            shadows: 18,
            whites: 16,
            blacks: -18,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: -100,
            saturation: -100,
            focusEnabled: true,
            aperture: 1.8,
            focalPoint: { x: 62, y: 32 },
            blurRadius: 5.5,
            clearZoneRadius: 36,
            subjectPop: 25,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 22,
            vignette: -20,
            clarity: 20,
          },
        },
      ],
    },
  },
  {
    id: "proto-2",
    title: "Charlotte & William • Coastal Cliff",
    category: "Sample Starred #2",
    clientNote: "“Our absolute favorite! Can you frame us nicely and make the ocean colors look rich?”",
    stars: 5,
    src: "/prototype/wedding.jpg",
    aspectRatio: "3:2",
    defaultFocalPoint: { x: 55, y: 32 },
    detectedSubjectBox: { x: 0.35, y: 0.15, w: 0.38, h: 0.8 },
    aiSource: "heuristic",
    aiAnalysis: {
      sceneType: "Coastal Wedding • Environmental Portrait",
      sceneCategory: "Portrait",
      lightingRating: "Balanced Daylight",
      critique:
        "Dramatic coastal composition with Pacific horizon. The couple is well composed with soft ocean backdrop. Recommended edit recovers shadow detail in the groom's navy suit and veil with crisp true ocean blues.",
      bestPracticeFixes: [
        "+0.3 EV Clean shadow exposure recovery on the couple",
        "Preserve crisp Pacific ocean blues and white lace highlights",
        "Position couple with balanced headroom in vertical framing",
        "Subtle f/2.8 environmental separation to soften distant rocks",
      ],
      recommendedCrop: "Original Full Frame / 4:5 Portrait",
      recommendedAperture: "f/2.8 Subtle Environmental Separation",
      vibes: [
        {
          name: "True-to-Life Coastal",
          tagline: "Natural skin tones, rich ocean blues, crisp veil detail",
          icon: "🌊",
          recipe: {
            exposure: 0.25,
            contrast: 12,
            highlights: -20,
            shadows: 25,
            whites: 8,
            blacks: -6,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: 18,
            saturation: 6,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 55, y: 32 },
            blurRadius: 3.2,
            clearZoneRadius: 35,
            subjectPop: 18,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 10,
            vignette: -12,
            clarity: 14,
          },
        },
        {
          name: "Cool Nordic Editorial",
          tagline: "Crisp cool ocean tones, bright whites, clean modern wedding look",
          icon: "❄️",
          recipe: {
            exposure: 0.2,
            contrast: 16,
            highlights: -24,
            shadows: 20,
            whites: 12,
            blacks: -10,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: -6,
            tint: 2,
            vibrance: 14,
            saturation: -4,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 55, y: 32 },
            blurRadius: 3.2,
            clearZoneRadius: 35,
            subjectPop: 20,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 12,
            vignette: -15,
            clarity: 16,
          },
        },
        {
          name: "Golden Sunset Warmth",
          tagline: "Warm amber dusk glow on cliff edges and wedding dress",
          icon: "🌅",
          recipe: {
            exposure: 0.3,
            contrast: 10,
            highlights: -18,
            shadows: 22,
            whites: 6,
            blacks: -4,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 14,
            tint: 6,
            vibrance: 16,
            saturation: 4,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 55, y: 32 },
            blurRadius: 3.2,
            clearZoneRadius: 35,
            subjectPop: 18,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 12,
            vignette: -14,
            clarity: 12,
          },
        },
      ],
    },
  },
  {
    id: "proto-3",
    title: "Marcus • Studio Portrait",
    category: "Sample Starred #3",
    clientNote: "“Love the mood on this! Keep the Rembrandt shadow crisp.”",
    stars: 4,
    src: "/prototype/fashion.jpg",
    aspectRatio: "3:2",
    defaultFocalPoint: { x: 52, y: 35 },
    detectedSubjectBox: { x: 0.25, y: 0.08, w: 0.5, h: 0.85 },
    aiSource: "heuristic",
    aiAnalysis: {
      sceneType: "Studio Editorial • Rembrandt Lighting",
      sceneCategory: "Editorial",
      lightingRating: "High Contrast Studio",
      critique:
        "Masterful directional lighting on the cheekbone and jawline. The textured backdrop adds organic depth. Recommended edit focuses on micro-contrast sculpting and eye sharpness without over-blurring hair or clothing.",
      bestPracticeFixes: [
        "Carve cheekbone highlights with +18 Clarity",
        "+0.15 EV midtone exposure boost to open the shadowed eye",
        "Neutral studio balance with matte charcoal background",
        "Subtle f/2.0 optical falloff with large subject clear zone",
      ],
      recommendedCrop: "Original Full Frame / 4:5 Magazine Cover",
      recommendedAperture: "f/2.0 Studio Falloff",
      vibes: [
        {
          name: "Clean Studio Editorial",
          tagline: "Neutral studio tones, crisp Rembrandt cheekbone highlight, rich blacks",
          icon: "📷",
          recipe: {
            exposure: 0.15,
            contrast: 18,
            highlights: 10,
            shadows: 12,
            whites: 15,
            blacks: -12,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: 8,
            saturation: -6,
            focusEnabled: true,
            aperture: 2.0,
            focalPoint: { x: 52, y: 35 },
            blurRadius: 4.0,
            clearZoneRadius: 38,
            subjectPop: 22,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 16,
            vignette: -18,
            clarity: 22,
          },
        },
        {
          name: "Silver Halide Monochrome",
          tagline: "Silky silver tones, deep blacks, high-contrast editorial punch",
          icon: "🖤",
          recipe: {
            exposure: 0.1,
            contrast: 26,
            highlights: 14,
            shadows: 8,
            whites: 20,
            blacks: -22,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: -100,
            saturation: -100,
            focusEnabled: true,
            aperture: 2.0,
            focalPoint: { x: 52, y: 35 },
            blurRadius: 4.0,
            clearZoneRadius: 38,
            subjectPop: 30,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 28,
            vignette: -24,
            clarity: 26,
          },
        },
        {
          name: "Warm Tuscan Tone",
          tagline: "Subtle amber undertone, rich wool texture, soft glow",
          icon: "🍂",
          recipe: {
            exposure: 0.15,
            contrast: 12,
            highlights: -10,
            shadows: 18,
            whites: 5,
            blacks: -6,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 10,
            tint: 4,
            vibrance: 12,
            saturation: 4,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 52, y: 35 },
            blurRadius: 3.0,
            clearZoneRadius: 40,
            subjectPop: 18,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 14,
            vignette: -12,
            clarity: 15,
          },
        },
      ],
    },
  },
  {
    id: "proto-4",
    title: "Detail Flatlay • Velvet Box & Rings",
    category: "Sample Starred #4",
    clientNote: "“Please highlight the gold calligraphy and rose velvet box with crisp focus!”",
    stars: 3,
    src: "/prototype/flatlay.jpg",
    aspectRatio: "3:2",
    defaultFocalPoint: { x: 50, y: 50 },
    detectedSubjectBox: { x: 0.4, y: 0.35, w: 0.25, h: 0.3 },
    aiSource: "heuristic",
    aiAnalysis: {
      sceneType: "Luxury Wedding Details • Macro Flatlay",
      sceneCategory: "Detail",
      lightingRating: "Soft Window Diffusion",
      critique:
        "Beautiful organic linen textures and soft ambient window lighting. The wedding rings in the dusty rose velvet box are the emotional hero. Recommended edit provides selective f/2.8 optical focus centered on the rings with natural linen whites.",
      bestPracticeFixes: [
        "Pinpoint focus reticle directly on wedding rings",
        "+0.2 EV clean exposure lift on white paper stationery",
        "Neutral true white balance (no golden yellow cast)",
        "Gentle macro optical depth with rings kept 100% sharp",
      ],
      recommendedCrop: "Original Full Frame / 1:1 Square",
      recommendedAperture: "f/2.8 Macro Isolation",
      vibes: [
        {
          name: "Clean Neutral Fine Art",
          tagline: "Crisp natural whites, delicate linen texture, true gold ink shine",
          icon: "💍",
          recipe: {
            exposure: 0.2,
            contrast: 6,
            highlights: 8,
            shadows: 18,
            whites: 10,
            blacks: 0,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: 10,
            saturation: 2,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 50, y: 50 },
            blurRadius: 3.5,
            clearZoneRadius: 28,
            subjectPop: 20,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 8,
            vignette: -6,
            clarity: 16,
          },
        },
        {
          name: "Soft Blush Romance",
          tagline: "Delicate rose tones, luminous highlights, romantic feel",
          icon: "🌸",
          recipe: {
            exposure: 0.25,
            contrast: 6,
            highlights: 10,
            shadows: 20,
            whites: 12,
            blacks: 2,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 4,
            tint: 8,
            vibrance: 14,
            saturation: 4,
            focusEnabled: true,
            aperture: 2.8,
            focalPoint: { x: 50, y: 50 },
            blurRadius: 3.5,
            clearZoneRadius: 28,
            subjectPop: 22,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 8,
            vignette: -6,
            clarity: 14,
          },
        },
        {
          name: "Crisp Vintage Heritage",
          tagline: "Accentuates the Leica metallic tones and deckled paper edges",
          icon: "📷",
          recipe: {
            exposure: 0.15,
            contrast: 14,
            highlights: -10,
            shadows: 14,
            whites: 8,
            blacks: -8,
            curvePoints: [...DEFAULT_CURVE_POINTS],
            temp: 0,
            tint: 0,
            vibrance: 6,
            saturation: -4,
            focusEnabled: true,
            aperture: 4.0,
            focalPoint: { x: 72, y: 25 },
            blurRadius: 2.0,
            clearZoneRadius: 30,
            subjectPop: 18,
            aspectRatio: "original",
            cropBox: { ...DEFAULT_CROP_BOX },
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            straighten: 0,
            grain: 16,
            vignette: -10,
            clarity: 22,
          },
        },
      ],
    },
  },
]

// ── Default Flat Recipe ───────────────────────────────────────────────────
const DEFAULT_RECIPE: EditRecipe = {
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
  clearZoneRadius: 36,
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

// ── Client-Side Intelligent Salience & Subject Locator ────────────────────
function detectSubjectSalience(img: HTMLImageElement): {
  focalPoint: { x: number; y: number }
  subjectBox: { x: number; y: number; w: number; h: number }
  avgLum: number
  isWarm: boolean
  isCool: boolean
  isMoody: boolean
} {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  const gridDim = 32
  canvas.width = gridDim
  canvas.height = gridDim

  let avgLum = 128
  let isWarm = false
  let isCool = false
  let isMoody = false
  let bestX = 50
  let bestY = 35

  if (ctx) {
    try {
      ctx.drawImage(img, 0, 0, gridDim, gridDim)
      const data = ctx.getImageData(0, 0, gridDim, gridDim).data
      let rSum = 0, gSum = 0, bSum = 0, lumSum = 0
      let darkPixels = 0

      let maxScore = -1
      let maxGX = gridDim / 2
      let maxGY = Math.round(gridDim * 0.35)

      for (let y = 1; y < gridDim - 1; y++) {
        for (let x = 1; x < gridDim - 1; x++) {
          const idx = (y * gridDim + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const lum = 0.299 * r + 0.587 * g + 0.114 * b

          rSum += r
          gSum += g
          bSum += b
          lumSum += lum
          if (lum < 50) darkPixels++

          const rightIdx = (y * gridDim + (x + 1)) * 4
          const downIdx = ((y + 1) * gridDim + x) * 4
          const rLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2]
          const dLum = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2]
          const edgeEnergy = Math.abs(lum - rLum) + Math.abs(lum - dLum)

          const isSkin = r > g && g > b && r > 65 && r - b > 18
          const idealY = gridDim * 0.35
          const yDist = Math.abs(y - idealY) / gridDim
          const xDist = Math.abs(x - gridDim / 2) / gridDim
          const compWeight = Math.max(0.3, 1 - (yDist * 1.2 + xDist * 0.8))

          const score = (edgeEnergy + (isSkin ? 30 : 0)) * compWeight

          if (score > maxScore) {
            maxScore = score
            maxGX = x
            maxGY = y
          }
        }
      }

      // Compute dynamic bounding box encompassing ALL detected subjects in the frame
      let minX = gridDim
      let maxX = 0
      let minY = gridDim
      let maxY = 0
      let foundSubjectPixels = 0

      for (let y = 1; y < gridDim - 1; y++) {
        for (let x = 1; x < gridDim - 1; x++) {
          const idx = (y * gridDim + x) * 4
          const r = data[idx]
          const g = data[idx + 1]
          const b = data[idx + 2]
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          const isSkin = r > g && g > b && r > 60 && r - b > 15
          const isHighContrast = lum > 40 && lum < 220

          if (isSkin || (isHighContrast && y > gridDim * 0.15 && y < gridDim * 0.85)) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            foundSubjectPixels++
          }
        }
      }

      const total = gridDim * gridDim
      avgLum = lumSum / total
      isWarm = rSum / total > bSum / total + 18
      isCool = bSum / total > rSum / total + 18
      isMoody = darkPixels / total > 0.4

      bestX = Math.round((maxGX / gridDim) * 100)
      bestY = Math.round((maxGY / gridDim) * 100)

      if (foundSubjectPixels > 10 && maxX > minX && maxY > minY) {
        const normMinX = Math.max(0.04, minX / gridDim - 0.05)
        const normMaxX = Math.min(0.96, maxX / gridDim + 0.05)
        const normMinY = Math.max(0.04, minY / gridDim - 0.06)
        const normMaxY = Math.min(0.96, maxY / gridDim + 0.08)

        return {
          focalPoint: { x: bestX, y: bestY },
          subjectBox: {
            x: normMinX,
            y: normMinY,
            w: Math.max(0.35, normMaxX - normMinX),
            h: Math.max(0.5, normMaxY - normMinY),
          },
          avgLum,
          isWarm,
          isCool,
          isMoody,
        }
      }
    } catch {
      // fallback
    }
  }

  const boxW = 0.55
  const boxH = 0.75
  const subjectBox = {
    x: Math.max(0.05, Math.min(0.95 - boxW, bestX / 100 - boxW / 2)),
    y: Math.max(0.05, Math.min(0.95 - boxH, bestY / 100 - boxH * 0.35)),
    w: boxW,
    h: boxH,
  }

  return { focalPoint: { x: bestX, y: bestY }, subjectBox, avgLum, isWarm, isCool, isMoody }
}

// ── Client-Side Intelligent Content Analyzer ──────────────────────────────
function analyzeUploadedImage(img: HTMLImageElement, filename: string): {
  aiAnalysis: SamplePhoto["aiAnalysis"]
  focalPoint: { x: number; y: number }
  subjectBox: { x: number; y: number; w: number; h: number }
} {
  const { focalPoint, subjectBox, avgLum, isWarm, isCool, isMoody } = detectSubjectSalience(img)
  const isPortrait = img.naturalHeight >= img.naturalWidth
  const isRaw = isRawFile(filename)

  let lightingRating: "Slight Underexposure" | "Balanced Daylight" | "High Contrast Studio" | "Soft Window Diffusion" =
    "Balanced Daylight"
  if (avgLum < 100) lightingRating = "Slight Underexposure"
  else if (isMoody) lightingRating = "High Contrast Studio"
  else lightingRating = "Balanced Daylight"

  const sceneType = isPortrait
    ? isWarm
      ? `Custom Upload: Natural Light Portrait • Golden Ambient ${isRaw ? "(RAW)" : ""}`
      : `Custom Upload: Natural Light Portrait • Balanced Whites ${isRaw ? "(RAW)" : ""}`
    : isMoody
    ? `Custom Upload: Moody Environmental Scene • Deep Contrast ${isRaw ? "(RAW)" : ""}`
    : `Custom Upload: Clean Ambient Scene • Neutral Lighting ${isRaw ? "(RAW)" : ""}`

  let critique = `Analyzed your uploaded ${isRaw ? "Camera RAW master" : "photo"} (${img.naturalWidth}×${img.naturalHeight}px). Average luminosity is ${Math.round(
    avgLum
  )}/255 with ${isWarm ? "warm amber" : isCool ? "cool blue" : "neutral balanced"} color temperature. Located primary subject focal zone at (${focalPoint.x}%, ${focalPoint.y}%). `
  if (avgLum < 110) {
    critique +=
      "Shadow areas hold rich dynamic range. We recommend a +0.25EV exposure lift on the subject, balanced neutral white balance, and natural optical depth with subject protection."
  } else if (avgLum > 165) {
    critique +=
      "High-key lighting detected. We recommend a -16 Highlights pull to protect delicate highlights, keeping skin tones natural and neutral."
  } else {
    critique +=
      "Well-balanced dynamic range and authentic colors. Recommended edits maintain authentic white balance with subtle f/2.0 depth-of-field separation."
  }

  const recommendedClearRadius = Math.max(36, Math.min(65, Math.round(subjectBox.w * 100 * 0.65)))

  const fixes = [
    avgLum < 110 ? "+0.25 EV Clean exposure lift on subject midtones" : "Balanced highlight roll-off with detail preservation",
    isWarm ? "Gentle warm accent (+10K) preserving natural skin tones" : "Preserved authentic neutral white balance (0K)",
    "Shadow micro-contrast and edge clarity tuning (+12)",
    `Natural f/2.0 optical depth with wide subject clear zone around (${focalPoint.x}%, ${focalPoint.y}%)`,
  ]

  const vibes = [
    {
      name: "True-to-Life Clean (Neutral)",
      tagline: "Natural skin tones, 0% color cast, balanced highlights & subtle depth",
      icon: "✨",
      recipe: {
        exposure: avgLum < 110 ? 0.25 : 0.1,
        contrast: 8,
        highlights: -16,
        shadows: 20,
        whites: 6,
        blacks: -5,
        curvePoints: [...DEFAULT_CURVE_POINTS],
        temp: 0,
        tint: 0,
        vibrance: 12,
        saturation: 2,
        focusEnabled: true,
        aperture: 2.0,
        focalPoint: { ...focalPoint },
        blurRadius: 4.0,
        clearZoneRadius: recommendedClearRadius,
        subjectPop: 15,
        aspectRatio: "original" as const,
        cropBox: { ...DEFAULT_CROP_BOX },
        panOffset: { x: 0, y: 0 },
        zoom: 1,
        straighten: 0,
        grain: 8,
        vignette: -10,
        clarity: 12,
      },
    },
    {
      name: "Cool Nordic Editorial",
      tagline: "Clean cool shadows, crisp whites, modern high-end editorial look",
      icon: "❄️",
      recipe: {
        exposure: 0.15,
        contrast: 14,
        highlights: -20,
        shadows: 18,
        whites: 10,
        blacks: -8,
        curvePoints: [...DEFAULT_CURVE_POINTS],
        temp: -6,
        tint: 2,
        vibrance: 10,
        saturation: -4,
        focusEnabled: true,
        aperture: 2.8,
        focalPoint: { ...focalPoint },
        blurRadius: 3.0,
        clearZoneRadius: recommendedClearRadius,
        subjectPop: 18,
        aspectRatio: "original" as const,
        cropBox: { ...DEFAULT_CROP_BOX },
        panOffset: { x: 0, y: 0 },
        zoom: 1,
        straighten: 0,
        grain: 12,
        vignette: -14,
        clarity: 15,
      },
    },
    {
      name: "Warm Golden Sunset",
      tagline: "Warm amber glow, lifted shadows & soft vintage film grain",
      icon: "🌅",
      recipe: {
        exposure: 0.2,
        contrast: 8,
        highlights: -18,
        shadows: 24,
        whites: 5,
        blacks: 4,
        curvePoints: [...DEFAULT_CURVE_POINTS],
        temp: 14,
        tint: 4,
        vibrance: 14,
        saturation: 4,
        focusEnabled: true,
        aperture: 2.0,
        focalPoint: { ...focalPoint },
        blurRadius: 4.0,
        clearZoneRadius: recommendedClearRadius,
        subjectPop: 15,
        aspectRatio: "original" as const,
        cropBox: { ...DEFAULT_CROP_BOX },
        panOffset: { x: 0, y: 0 },
        zoom: 1,
        straighten: 0,
        grain: 16,
        vignette: -12,
        clarity: 10,
      },
    },
  ]

  return {
    aiAnalysis: {
      sceneType,
      sceneCategory: isPortrait ? "Portrait" : "Editorial",
      lightingRating,
      critique,
      bestPracticeFixes: fixes,
      recommendedCrop: "Original Full Frame / Custom Framing",
      recommendedAperture: "f/2.0 Subtle Optical Depth",
      vibes,
    },
    focalPoint,
    subjectBox,
  }
}

// ── Main Component ────────────────────────────────────────────────────────
export function PrototypeStudio() {
  const filterId = useId().replace(/:/g, "-")

  // Photos state (sample + user uploaded)
  const [photoList, setPhotoList] = useState<SamplePhoto[]>(DEFAULT_PHOTOS)
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0)
  const currentPhoto = photoList[selectedPhotoIdx] || photoList[0]

  // Recipe per photo (persisted in state)
  const [recipes, setRecipes] = useState<Record<string, EditRecipe>>(() => {
    const init: Record<string, EditRecipe> = {}
    DEFAULT_PHOTOS.forEach((p) => {
      init[p.id] = { ...p.aiAnalysis.vibes[0].recipe }
    })
    return init
  })

  const activeRecipe = recipes[currentPhoto.id] || DEFAULT_RECIPE

  // Tool Tabs: 'ai' | 'light' | 'color' | 'focus' | 'crop' | 'effects'
  const [activeTab, setActiveTab] = useState<"ai" | "light" | "color" | "focus" | "crop" | "effects">("ai")

  // Left & Right Sidebars Visibility Toggles
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)

  // Canvas View Mode: 'split' | 'edited'
  const [viewMode, setViewMode] = useState<"split" | "edited">("split")
  const [splitPos, setSplitPos] = useState(50) // 0..100 percentage
  const [isHoldingSpace, setIsHoldingSpace] = useState(false)
  const [showSubjectBox, setShowSubjectBox] = useState(false)

  // Dragging states
  const [isDraggingFocalPoint, setIsDraggingFocalPoint] = useState(false)
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null)
  const cropDragStartRef = useRef<{ clientX: number; clientY: number; startCrop: CropRect } | null>(null)

  // AI Scanning state
  const [isScanningAI, setIsScanningAI] = useState(false)
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  // Multi-File & Folder Import state
  const [isImporting, setIsImporting] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchProgress, setBatchProgress] = useState<number | null>(null)

  // Canvas container ref for mouse dragging split slider & reticle
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const photoFrameRef = useRef<HTMLDivElement>(null)
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault()
        setIsHoldingSpace(true)
      }
      if (e.code === "Enter" && activeTab === "crop") {
        e.preventDefault()
        handleApplyCrop()
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setIsHoldingSpace(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [activeTab])

  // ── Slider Handlers ───────────────────────────────────────────────────────
  const updateRecipe = useCallback(
    (updates: Partial<EditRecipe>) => {
      setRecipes((prev) => ({
        ...prev,
        [currentPhoto.id]: {
          ...(prev[currentPhoto.id] || DEFAULT_RECIPE),
          ...updates,
        },
      }))
    },
    [currentPhoto.id]
  )

  function handleApplyVibe(recipe: EditRecipe, vibeName: string) {
    updateRecipe({ ...recipe })
    toast.success(`Applied "${vibeName}" recipe ✨`)
  }

  function handleReset() {
    updateRecipe({ ...DEFAULT_RECIPE })
    toast.info("Reset to original values")
  }

  // ── Crop Action & Commit ──────────────────────────────────────────────────
  function handleApplyCrop() {
    updateRecipe({ isCropCommitted: true })
    toast.success("✨ Crop applied to photo framing!")
    setActiveTab("ai")
  }

  function handleResetCrop() {
    updateRecipe({
      aspectRatio: "original",
      cropBox: { ...DEFAULT_CROP_BOX },
      isCropCommitted: false,
      straighten: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
    })
    toast.info("Restored to original full frame")
  }

  async function handleRotateCW() {
    if (!currentPhoto) return
    try {
      const img = new Image()
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const w = img.naturalWidth
      const h = img.naturalHeight

      canvas.width = h
      canvas.height = w

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((90 * Math.PI) / 180)
      ctx.drawImage(img, -w / 2, -h / 2)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.98)
      })

      const newUrl = URL.createObjectURL(blob)
      const updatedPhoto: SamplePhoto = {
        ...currentPhoto,
        src: newUrl,
        aspectRatio: canvas.width > canvas.height ? "3:2" : "2:3",
      }

      setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
      toast.success("Rotated 90° Clockwise ↻")
    } catch {
      toast.error("Failed to rotate image")
    }
  }

  async function handleRotateCCW() {
    if (!currentPhoto) return
    try {
      const img = new Image()
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const w = img.naturalWidth
      const h = img.naturalHeight

      canvas.width = h
      canvas.height = w

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((-90 * Math.PI) / 180)
      ctx.drawImage(img, -w / 2, -h / 2)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.98)
      })

      const newUrl = URL.createObjectURL(blob)
      const updatedPhoto: SamplePhoto = {
        ...currentPhoto,
        src: newUrl,
        aspectRatio: canvas.width > canvas.height ? "3:2" : "2:3",
      }

      setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
      toast.success("Rotated 90° Counter-Clockwise ↺")
    } catch {
      toast.error("Failed to rotate image")
    }
  }

  async function handleFlipH() {
    if (!currentPhoto) return
    try {
      const img = new Image()
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(-1, 1)
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.98)
      })

      const newUrl = URL.createObjectURL(blob)
      const updatedPhoto: SamplePhoto = {
        ...currentPhoto,
        src: newUrl,
      }

      setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
      toast.success("Flipped Horizontal")
    } catch {
      toast.error("Failed to flip image")
    }
  }

  async function handleFlipV() {
    if (!currentPhoto) return
    try {
      const img = new Image()
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(1, -1)
      ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.98)
      })

      const newUrl = URL.createObjectURL(blob)
      const updatedPhoto: SamplePhoto = {
        ...currentPhoto,
        src: newUrl,
      }

      setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
      toast.success("Flipped Vertical")
    } catch {
      toast.error("Failed to flip image")
    }
  }

  // ── Draggable Focal Target Reticle ─────────────────────────────────────────
  const handleFocalReticleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFocalPoint(true)
  }

  const handleCanvasClickToSetFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!photoFrameRef.current) return
    const rect = photoFrameRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)))
    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)))
    updateRecipe({ focalPoint: { x, y }, focusEnabled: true })
  }

  useEffect(() => {
    function handleFocalMouseMove(e: MouseEvent) {
      if (!isDraggingFocalPoint || !photoFrameRef.current) return
      const rect = photoFrameRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)))
      const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)))
      updateRecipe({ focalPoint: { x, y }, focusEnabled: true })
    }

    function handleFocalMouseUp() {
      setIsDraggingFocalPoint(false)
    }

    if (isDraggingFocalPoint) {
      window.addEventListener("mousemove", handleFocalMouseMove)
      window.addEventListener("mouseup", handleFocalMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleFocalMouseMove)
      window.removeEventListener("mouseup", handleFocalMouseUp)
    }
  }, [isDraggingFocalPoint, updateRecipe])

  // ── Interactive Resizable & Draggable Crop Box ─────────────────────────────
  const currentCrop = activeRecipe.cropBox || DEFAULT_CROP_BOX
  const isCustomCropped =
    currentCrop.x > 0 || currentCrop.y > 0 || currentCrop.width < 100 || currentCrop.height < 100

  const handleCropHandleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveCropHandle(handle)
    cropDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCrop: { ...currentCrop },
    }
  }

  useEffect(() => {
    function handleCropMouseMove(e: MouseEvent) {
      if (!activeCropHandle || !cropDragStartRef.current || !photoFrameRef.current) return
      const rect = photoFrameRef.current.getBoundingClientRect()
      const deltaXPercent = ((e.clientX - cropDragStartRef.current.clientX) / rect.width) * 100
      const deltaYPercent = ((e.clientY - cropDragStartRef.current.clientY) / rect.height) * 100
      const { startCrop } = cropDragStartRef.current

      let newX = startCrop.x
      let newY = startCrop.y
      let newW = startCrop.width
      let newH = startCrop.height

      if (activeCropHandle === "move") {
        newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaXPercent))
        newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaYPercent))
      } else {
        if (activeCropHandle.includes("w")) {
          const proposedX = Math.max(0, Math.min(startCrop.x + startCrop.width - 10, startCrop.x + deltaXPercent))
          newW = startCrop.width - (proposedX - startCrop.x)
          newX = proposedX
        }
        if (activeCropHandle.includes("e")) {
          newW = Math.max(10, Math.min(100 - startCrop.x, startCrop.width + deltaXPercent))
        }
        if (activeCropHandle.includes("n")) {
          const proposedY = Math.max(0, Math.min(startCrop.y + startCrop.height - 10, startCrop.y + deltaYPercent))
          newH = startCrop.height - (proposedY - startCrop.y)
          newY = proposedY
        }
        if (activeCropHandle.includes("s")) {
          newH = Math.max(10, Math.min(100 - startCrop.y, startCrop.height + deltaYPercent))
        }
      }

      updateRecipe({
        cropBox: {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        },
        aspectRatio: "custom",
        isCropCommitted: false,
      })
    }

    function handleCropMouseUp() {
      setActiveCropHandle(null)
      cropDragStartRef.current = null
    }

    if (activeCropHandle) {
      window.addEventListener("mousemove", handleCropMouseMove)
      window.addEventListener("mouseup", handleCropMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleCropMouseMove)
      window.removeEventListener("mouseup", handleCropMouseUp)
    }
  }, [activeCropHandle, updateRecipe])

  // ── Preset Aspect Ratio Switcher ──────────────────────────────────────────
  function handleSelectAspectRatio(ratio: EditRecipe["aspectRatio"]) {
    if (ratio === "original") {
      updateRecipe({
        aspectRatio: "original",
        cropBox: { ...DEFAULT_CROP_BOX },
        isCropCommitted: false,
      })
      return
    }

    if (ratio === "custom") {
      updateRecipe({ aspectRatio: "custom" })
      return
    }

    let targetRatio = 1
    if (ratio === "1:1") targetRatio = 1
    else if (ratio === "4:5") targetRatio = 4 / 5
    else if (ratio === "9:16") targetRatio = 9 / 16
    else if (ratio === "16:9") targetRatio = 16 / 9
    else if (ratio === "2:3") targetRatio = 2 / 3
    else if (ratio === "3:2") targetRatio = 3 / 2

    let w = 90
    let h = 90
    if (targetRatio > 1) {
      h = Math.round(w / targetRatio)
    } else {
      w = Math.round(h * targetRatio)
    }
    const x = Math.round((100 - w) / 2)
    const y = Math.round((100 - h) / 2)

    updateRecipe({
      aspectRatio: ratio,
      cropBox: { x, y, width: w, height: h },
      isCropCommitted: false,
    })
  }

  // ── Deep Vision AI Scan Trigger ───────────────────────────────────────────
  async function handleScanWithAI() {
    setIsScanningAI(true)
    toast.info("Scanning photo content with Multimodal Vision AI...")

    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Image load error"))
      })

      const canvas = document.createElement("canvas")
      const maxDim = 1024
      let w = img.naturalWidth || 800
      let h = img.naturalHeight || 600
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        } else {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context error")
      ctx.drawImage(img, 0, 0, w, h)
      const base64 = canvas.toDataURL("image/jpeg", 0.85)

      const res = await fetch("/api/prototype/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: "image/jpeg",
          apiKey: geminiApiKey || undefined,
        }),
      })

      const data = await res.json()

      if (data.success && data.analysis) {
        const ai = data.analysis
        const updatedPhoto: SamplePhoto = {
          ...currentPhoto,
          aiSource: "gemini",
          defaultFocalPoint: ai.detectedFocalPoint || currentPhoto.defaultFocalPoint,
          detectedSubjectBox: ai.detectedSubjectBox || currentPhoto.detectedSubjectBox,
          aiAnalysis: {
            sceneType: ai.sceneType,
            sceneCategory: ai.sceneCategory,
            lightingRating: ai.lightingRating,
            critique: ai.critique,
            bestPracticeFixes: ai.bestPracticeFixes,
            recommendedCrop: ai.recommendedCrop,
            recommendedAperture: ai.recommendedAperture,
            vibes: ai.vibes.map((v: any) => ({
              name: v.name,
              tagline: v.tagline,
              icon: v.icon,
              recipe: {
                ...DEFAULT_RECIPE,
                ...v.recipe,
                curvePoints: [...DEFAULT_CURVE_POINTS],
                blurRadius: Math.min(5, v.recipe.blurRadius || 4),
                clearZoneRadius: v.recipe.clearZoneRadius || 36,
              },
            })),
          },
        }

        setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
        updateRecipe({ ...updatedPhoto.aiAnalysis.vibes[0].recipe })
        toast.success("✨ Deep Gemini Vision analysis complete!")
      } else {
        const { aiAnalysis, focalPoint, subjectBox } = analyzeUploadedImage(img, currentPhoto.title)
        const updatedPhoto: SamplePhoto = {
          ...currentPhoto,
          aiSource: "heuristic",
          defaultFocalPoint: focalPoint,
          detectedSubjectBox: subjectBox,
          aiAnalysis,
        }
        setPhotoList((prev) => prev.map((p, idx) => (idx === selectedPhotoIdx ? updatedPhoto : p)))
        updateRecipe({ ...aiAnalysis.vibes[0].recipe })
        toast.success("✨ Content-Aware Salience analysis updated!")
      }
    } catch {
      toast.error("Vision scan failed. Please try again.")
    } finally {
      setIsScanningAI(false)
    }
  }

  // ── Multi-File & Camera RAW File Processing Engine ────────────────────────
  const processUploadedFiles = useCallback(async (files: FileList | File[]) => {
    const allFiles = Array.from(files)
    const validFiles = allFiles.filter((f) => {
      return f.type.startsWith("image/") || isRawFile(f.name)
    })

    if (validFiles.length === 0) {
      toast.error("Please select valid image or camera RAW files (.ARW, .CR2, .CR3, .NEF, .DNG, .RAF, .ORF, .JPG, .PNG)")
      return
    }

    setIsImporting(true)
    toast.info(`Importing ${validFiles.length} photo${validFiles.length > 1 ? "s" : ""}...`)

    const newPhotosToAdd: SamplePhoto[] = []
    const newRecipesToAdd: Record<string, EditRecipe> = {}

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        const { url, isRaw } = await decodePhotoOrRawFile(file)
        await new Promise<void>((resolve) => {
          const img = new Image()
          img.src = url
          img.onload = () => {
            const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
            const { aiAnalysis, focalPoint, subjectBox } = analyzeUploadedImage(img, file.name)
            const isLandscape = img.naturalWidth > img.naturalHeight
            const ext = file.name.split(".").pop()?.toUpperCase() || ""
            const newPhoto: SamplePhoto = {
              id,
              title: file.name.replace(/\.[^/.]+$/, ""),
              category: isRaw ? `RAW Master (${ext}) 📷` : "Your Uploaded Photo ⭐",
              clientNote: isRaw
                ? `“Camera RAW master (${ext}) — decoded embedded preview with full dynamic range.”`
                : "“Client Favorite: Starred photo from your upload.”",
              stars: 5,
              src: url,
              aspectRatio: isLandscape ? "3:2" : "2:3",
              isUserUploaded: true,
              isRaw,
              defaultFocalPoint: focalPoint,
              detectedSubjectBox: subjectBox,
              aiSource: "heuristic",
              aiAnalysis,
            }
            newPhotosToAdd.push(newPhoto)
            newRecipesToAdd[id] = { ...aiAnalysis.vibes[0].recipe }
            resolve()
          }
          img.onerror = () => {
            console.warn(`Could not render image for ${file.name}`)
            resolve()
          }
        })
      } catch (err) {
        console.warn(`Failed to process ${file.name}:`, err)
      }
    }

    if (newPhotosToAdd.length > 0) {
      setPhotoList((prev) => [...newPhotosToAdd, ...prev])
      setRecipes((prev) => ({ ...prev, ...newRecipesToAdd }))
      setSelectedPhotoIdx(0)
      toast.success(
        `✨ Successfully imported & analyzed ${newPhotosToAdd.length} photo${newPhotosToAdd.length > 1 ? "s" : ""}!`
      )
    }

    setIsImporting(false)
  }, [])

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files)
    }
  }

  // ── Drag and drop anywhere on canvas ──
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files)
    }
  }

  // ── Split Slider Drag ─────────────────────────────────────────────────────
  const handleSplitMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingSplit || !canvasWrapRef.current) return
      const rect = canvasWrapRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
      setSplitPos(Math.round((x / rect.width) * 100))
    },
    [isDraggingSplit]
  )

  const handleSplitMouseUp = useCallback(() => {
    setIsDraggingSplit(false)
  }, [])

  useEffect(() => {
    if (isDraggingSplit) {
      window.addEventListener("mousemove", handleSplitMouseMove)
      window.addEventListener("mouseup", handleSplitMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleSplitMouseMove)
      window.removeEventListener("mouseup", handleSplitMouseUp)
    }
  }, [isDraggingSplit, handleSplitMouseMove, handleSplitMouseUp])

  // ── High-Res Canvas Export / Download (With Exact Crop Bounds) ─────────────
  async function handleExportDownload() {
    toast.info("Rendering high-res master with current recipe and crop...")
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Failed to load image"))
      })

      const naturalW = img.naturalWidth || 1920
      const naturalH = img.naturalHeight || 1280

      const crop = activeRecipe.cropBox || DEFAULT_CROP_BOX
      const cropX = Math.round((crop.x / 100) * naturalW)
      const cropY = Math.round((crop.y / 100) * naturalH)
      const cropW = Math.max(10, Math.round((crop.width / 100) * naturalW))
      const cropH = Math.max(10, Math.round((crop.height / 100) * naturalH))

      const canvas = document.createElement("canvas")
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas context unavailable")

      const b = 1 + activeRecipe.exposure * 0.4
      const c = 1 + activeRecipe.contrast * 0.008
      const s = Math.max(0, 1 + (activeRecipe.saturation + activeRecipe.vibrance * 0.5) * 0.01)
      const sep = activeRecipe.temp > 0 ? activeRecipe.temp * 0.002 : 0
      const hr = activeRecipe.tint * 0.3

      ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${sep}) hue-rotate(${hr}deg)`
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      if (activeRecipe.vignette !== 0) {
        ctx.filter = "none"
        const grad = ctx.createRadialGradient(cropW / 2, cropH / 2, Math.min(cropW, cropH) * 0.3, cropW / 2, cropH / 2, Math.max(cropW, cropH) * 0.7)
        grad.addColorStop(0, "rgba(0,0,0,0)")
        grad.addColorStop(1, `rgba(0,0,0,${Math.abs(activeRecipe.vignette) * 0.008})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, cropW, cropH)
      }

      // Live High-Fidelity Sharpening Matrix on Export
      if ((activeRecipe.sharpening || 0) > 0) {
        try {
          const imgData = ctx.getImageData(0, 0, cropW, cropH)
          const data = imgData.data
          const copy = new Uint8ClampedArray(data)
          const k = ((activeRecipe.sharpening || 0) / 100) * 0.65
          const center = 1 + 4 * k

          for (let y = 1; y < cropH - 1; y++) {
            for (let x = 1; x < cropW - 1; x++) {
              const idx = (y * cropW + x) * 4
              const top = ((y - 1) * cropW + x) * 4
              const bottom = ((y + 1) * cropW + x) * 4
              const left = (y * cropW + (x - 1)) * 4
              const right = (y * cropW + (x + 1)) * 4

              for (let c = 0; c < 3; c++) {
                const val = copy[idx + c] * center - (copy[top + c] + copy[bottom + c] + copy[left + c] + copy[right + c]) * k
                data[idx + c] = Math.max(0, Math.min(255, val))
              }
            }
          }
          ctx.putImageData(imgData, 0, 0)
        } catch {
          // ignore if cross-origin restricts getImageData
        }
      }

      canvas.toBlob((blob) => {
        if (!blob) throw new Error("Blob conversion failed")
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `edited-${currentPhoto.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`✨ Downloaded high-resolution cropped edit for "${currentPhoto.title}"!`)
      }, "image/jpeg", 0.95)
    } catch {
      toast.error("Failed to render export image.")
    }
  }

  // ── Batch Apply ───────────────────────────────────────────────────────────
  async function handleRunBatchSync() {
    setBatchProgress(0)
    for (let i = 1; i <= 4; i++) {
      await new Promise((res) => setTimeout(res, 350))
      setBatchProgress(i * 25)
    }
    const currentVibe = activeRecipe
    const newRecipes: Record<string, EditRecipe> = {}
    photoList.forEach((p) => {
      newRecipes[p.id] = { ...currentVibe }
    })
    setRecipes(newRecipes)
    toast.success(`✨ Successfully synced AI edits across all ${photoList.length} photos!`)
    setTimeout(() => {
      setIsBatchModalOpen(false)
      setBatchProgress(null)
    }, 500)
  }

  // ── Generate Live SVG Tone Curve LUT Table Values ─────────────────────────
  const rLutString = generateToneLutString({
    points: activeRecipe.curvePoints || DEFAULT_CURVE_POINTS,
    highlights: activeRecipe.highlights,
    shadows: activeRecipe.shadows,
    whites: activeRecipe.whites,
    blacks: activeRecipe.blacks,
    contrast: activeRecipe.contrast,
  })

  const gLutString = generateToneLutString({
    points: activeRecipe.curvePoints || DEFAULT_CURVE_POINTS,
    highlights: activeRecipe.highlights,
    shadows: activeRecipe.shadows,
    whites: activeRecipe.whites,
    blacks: activeRecipe.blacks,
    contrast: activeRecipe.contrast,
  })

  const bLutString = generateToneLutString({
    points: activeRecipe.curvePoints || DEFAULT_CURVE_POINTS,
    highlights: activeRecipe.highlights,
    shadows: activeRecipe.shadows,
    whites: activeRecipe.whites,
    blacks: activeRecipe.blacks,
    contrast: activeRecipe.contrast,
  })

  // ── Generate CSS Filter / Optical Blur Calculations ──────────────────────
  const brightness = 1 + activeRecipe.exposure * 0.4
  const saturate = Math.max(0, 1 + (activeRecipe.saturation + activeRecipe.vibrance * 0.5) * 0.01)
  const sepia = activeRecipe.temp > 0 ? activeRecipe.temp * 0.002 : 0
  const hueRotate = activeRecipe.tint * 0.3

  const opticalFstopScale = Math.max(0, (1 / activeRecipe.aperture - 1 / 8) * 10)
  const effectiveBlurPx = activeRecipe.focusEnabled ? Math.min(activeRecipe.blurRadius, opticalFstopScale) : 0

  const clearRadius = activeRecipe.clearZoneRadius || 36
  const innerPercent = Math.max(10, Math.round(clearRadius * 0.65))
  const outerPercent = Math.min(100, Math.round(clearRadius * 1.45))
  const maskGradient = `radial-gradient(ellipse ${clearRadius * 1.1}% ${clearRadius * 1.5}% at ${activeRecipe.focalPoint.x}% ${activeRecipe.focalPoint.y}%, transparent ${innerPercent}%, rgba(0,0,0,0.5) ${clearRadius}%, black ${outerPercent}%)`

  const filterString = isHoldingSpace
    ? "none"
    : `url(#tone-lut-${filterId}) brightness(${brightness}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hueRotate}deg)`

  const sharpenK = ((activeRecipe.sharpening || 0) / 100) * 0.75

  // Determine if canvas should render in committed cropped zoom or full interactive mode
  const showCommittedCropView = activeTab !== "crop" && isCustomCropped

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col flex-1 w-full h-full max-h-full bg-[#0c0c0e] text-neutral-100 select-none overflow-hidden font-sans relative"
    >
      {/* ── Hardware-Accelerated SVG Tone Curve LUT & Sharpening Filter ── */}
      <svg className="absolute w-0 h-0 pointer-events-none opacity-0" aria-hidden="true">
        <defs>
          <filter id={`tone-lut-${filterId}`} colorInterpolationFilters="sRGB">
            <feComponentTransfer result="toned">
              <feFuncR type="table" tableValues={rLutString} />
              <feFuncG type="table" tableValues={gLutString} />
              <feFuncB type="table" tableValues={bLutString} />
            </feComponentTransfer>
            {(activeRecipe.sharpening ?? 0) > 0 ? (
              <feConvolveMatrix
                in="toned"
                order="3"
                kernelMatrix={`0 -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} ${(1 + 4 * sharpenK).toFixed(3)} -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} 0`}
                preserveAlpha="true"
              />
            ) : null}
          </filter>
        </defs>
      </svg>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2,.pef,.srw"
        multiple
        onClick={(e) => {
          ;(e.target as HTMLInputElement).value = ""
        }}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in modern browsers
        webkitdirectory=""
        directory=""
        multiple
        onClick={(e) => {
          ;(e.target as HTMLInputElement).value = ""
        }}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-amber-400 p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center mb-4 animate-bounce">
              <FileUp className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold font-oswald uppercase text-white tracking-wider">
              Drop Photos or RAW Files Here
            </h2>
            <p className="text-sm text-neutral-300 max-w-md mt-2">
              Supports JPEG, PNG, WEBP, TIFF, and camera RAWs (Sony ARW, Canon CR2/CR3, Nikon NEF, Adobe DNG, Fuji RAF)!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Studio Top Header Bar ── */}
      <header className="h-14 border-b border-neutral-800 bg-[#121215] px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-30 overflow-x-auto scrollbar-none">
        {/* Left: Filmstrip Toggle & Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setIsFilmstripOpen(!isFilmstripOpen)}
            className={cn(
              "p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border",
              isFilmstripOpen
                ? "bg-neutral-800 border-neutral-700 text-amber-400"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            )}
            title={isFilmstripOpen ? "Collapse Filmstrip" : "Expand Filmstrip"}
          >
            {isFilmstripOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>

          <Link
            href="/dashboard"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-neutral-600 hidden sm:inline">/</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-oswald uppercase tracking-widest text-amber-400 whitespace-nowrap">
              AI Creative Studio
            </span>
            <Badge variant="outline" className="hidden lg:inline-flex text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10 font-mono">
              Content-Aware
            </Badge>
          </div>
        </div>

        {/* Center: AI Vision Scan & View Mode Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* AI Vision Scan */}
          <button
            disabled={isScanningAI}
            onClick={handleScanWithAI}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isScanningAI ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Scanning...</span>
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                <span>AI Vision Scan</span>
              </>
            )}
          </button>

          <div className="h-5 w-px bg-neutral-800 mx-1 hidden sm:block" />

          {/* View Mode switcher */}
          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer",
                viewMode === "split"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <SplitSquareVertical className="h-3 w-3" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode("edited")}
              className={cn(
                "px-2 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer",
                viewMode === "edited"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <Eye className="h-3 w-3" />
              <span className="hidden md:inline">Edited</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center text-[11px] text-neutral-400 bg-neutral-900/80 px-2 py-1 rounded-md border border-neutral-800">
            <span className="text-neutral-500 mr-1">Hold</span>
            <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-300">Space</kbd>
            <span className="text-neutral-500 ml-1">Original</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="p-1.5 sm:p-2 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Gemini Vision API Key Settings"
          >
            <Key className="h-4 w-4" />
          </button>

          {/* Quick Orientation Rotate Tools */}
          <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
            <button
              onClick={handleRotateCCW}
              className="p-1.5 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Rotate 90° Left (Counter-Clockwise)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRotateCW}
              className="p-1.5 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Rotate 90° Right (Clockwise)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFlipH}
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer",
                activeRecipe.flipH
                  ? "text-amber-400 bg-amber-400/20"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              )}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-1.5 sm:p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Reset All Edits to Original"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleExportDownload}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
            title="Download full resolution cropped JPEG"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden lg:inline">Download</span>
          </button>

          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden lg:inline">Batch ({photoList.length})</span>
          </button>

          {/* Toggle Inspector Button */}
          <button
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={cn(
              "p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer border",
              isInspectorOpen
                ? "bg-neutral-800 border-neutral-700 text-amber-400"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            )}
            title={isInspectorOpen ? "Collapse Inspector" : "Expand Inspector"}
          >
            {isInspectorOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ── Main Studio Workspace (Left Queue + Canvas + Right Inspector) ── */}
      <div className="flex flex-1 min-h-0 w-full relative overflow-hidden">
        {/* ── Left Sidebar Filmstrip & Ingest Queue ── */}
        <aside
          className={cn(
            "bg-[#121215] border-r border-neutral-800 flex flex-col shrink-0 z-20 h-full overflow-hidden transition-all duration-200",
            isFilmstripOpen ? "w-48 sm:w-56 lg:w-60" : "w-0 border-r-0"
          )}
        >
          <div className="w-48 sm:w-56 lg:w-60 h-full flex flex-col min-h-0 overflow-hidden">
            {/* Filmstrip Header with Import Actions */}
            <div className="p-3 border-b border-neutral-800 bg-neutral-900/60 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-oswald uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400" /> Client Queue
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {selectedPhotoIdx + 1}/{photoList.length}
                </span>
              </div>

              {/* Import Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-[10px] font-bold flex items-center justify-center gap-1 border border-amber-500/20 transition-all cursor-pointer"
                  title="Import multiple photos or RAWs"
                >
                  <Plus className="h-3 w-3" />
                  <span>Photos</span>
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-amber-400 text-[10px] font-bold flex items-center justify-center gap-1 border border-neutral-700 transition-all cursor-pointer"
                  title="Import an entire shoot folder"
                >
                  <FolderUp className="h-3 w-3 text-amber-400" />
                  <span>Folder</span>
                </button>
              </div>
            </div>

            {/* Vertical Photo Cards List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 scrollbar-thin scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600">
              {photoList.map((photo, idx) => {
                const isSelected = idx === selectedPhotoIdx
                return (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhotoIdx(idx)}
                    className={cn(
                      "w-full rounded-xl overflow-hidden text-left border transition-all cursor-pointer group flex flex-col p-1.5",
                      isSelected
                        ? "bg-neutral-800/90 border-amber-400 shadow-md ring-1 ring-amber-400/50"
                        : "bg-neutral-900/50 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700"
                    )}
                  >
                    <div className="relative aspect-[3/2] w-full rounded-lg overflow-hidden bg-black/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.src} alt={photo.title} className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-xs rounded px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span className="text-[9px] font-mono text-amber-400 font-bold">{photo.stars}</span>
                      </div>
                      {photo.isRaw ? (
                        <div className="absolute top-1 left-1 bg-amber-500 backdrop-blur-xs rounded px-1.5 py-0.5 shadow-sm">
                          <span className="text-[8px] font-black text-black uppercase font-mono tracking-wider">
                            RAW
                          </span>
                        </div>
                      ) : photo.isUserUploaded ? (
                        <div className="absolute top-1 left-1 bg-emerald-500 backdrop-blur-xs rounded px-1.5 py-0.5 shadow-sm">
                          <span className="text-[8px] font-black text-black uppercase tracking-wider">Custom</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-1.5 px-0.5 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-neutral-200 truncate group-hover:text-white">
                        {photo.title}
                      </p>
                      <span className="text-[9px] font-mono text-neutral-500 shrink-0 ml-1">#{idx + 1}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* ── Center Stage Canvas (Maximum Vertical & Horizontal Area) ── */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#09090b] relative overflow-hidden">
          {/* Canvas Viewport Container */}
          <div
            ref={canvasWrapRef}
            onClick={activeTab === "focus" ? handleCanvasClickToSetFocus : undefined}
            className={cn(
              "flex-1 w-full h-full min-h-0 min-w-0 relative flex items-center justify-center p-4 sm:p-6 select-none overflow-hidden",
              activeTab === "focus" ? "cursor-crosshair" : "cursor-default"
            )}
          >
            {/* Background Studio Grid texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />

            {/* Active Crop Notice Badge in Non-Crop Tabs */}
            {showCommittedCropView && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("crop")}
                  className="bg-black/80 hover:bg-neutral-900 border border-amber-500/40 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg transition-all cursor-pointer"
                >
                  <Crop className="h-3.5 w-3.5" />
                  <span>
                    Crop: {activeRecipe.aspectRatio.toUpperCase()} ({currentCrop.width}%×{currentCrop.height}%)
                  </span>
                  <span className="text-[10px] text-neutral-400 font-normal underline ml-1">Edit</span>
                </button>
              </div>
            )}

            {/* Photo Container Frame - Guaranteed 100% Fit with ZERO Top Clipping */}
            <div
              ref={photoFrameRef}
              className="relative rounded-lg overflow-hidden shadow-2xl transition-all duration-200 border border-neutral-800/80 bg-black flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: activeRecipe.straighten !== 0 ? `rotate(${activeRecipe.straighten}deg)` : undefined,
              }}
            >
              {/* Image Layer Base (Handles Committed Cropping Zoom & Offset) */}
              <div
                className="relative w-full h-full overflow-hidden flex items-center justify-center max-h-full max-w-full"
                style={
                  showCommittedCropView
                    ? {
                        clipPath: `inset(${currentCrop.y}% ${100 - (currentCrop.x + currentCrop.width)}% ${
                          100 - (currentCrop.y + currentCrop.height)
                        }% ${currentCrop.x}%)`,
                      }
                    : undefined
                }
              >
                {/* Layer 1: Original Image Base */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentPhoto.src}
                  alt={currentPhoto.title}
                  className="pointer-events-none block max-w-full max-h-[calc(100vh-100px)] w-auto h-auto object-contain"
                />

                {/* Layer 2: Edited Image with Live Tonal LUT + Shaders */}
                {viewMode !== "split" ? (
                  <div
                    className="absolute inset-0 transition-opacity duration-150 pointer-events-none overflow-hidden flex items-center justify-center"
                    style={{
                      filter: filterString,
                      opacity: isHoldingSpace ? 0 : 1,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPhoto.src}
                      alt={currentPhoto.title}
                      className="block max-w-full max-h-[calc(100vh-100px)] w-auto h-auto object-contain"
                    />

                    {/* Synthetic Bokeh Layer */}
                    {activeRecipe.focusEnabled && effectiveBlurPx > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none transition-all"
                        style={{
                          backdropFilter: `blur(${effectiveBlurPx}px)`,
                          maskImage: maskGradient,
                          WebkitMaskImage: maskGradient,
                        }}
                      />
                    )}

                    {/* Subject Pop Radial Lighting */}
                    {activeRecipe.focusEnabled && activeRecipe.subjectPop > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none mix-blend-overlay"
                        style={{
                          background: `radial-gradient(circle 35% at ${activeRecipe.focalPoint.x}% ${activeRecipe.focalPoint.y}%, rgba(255,255,255,${
                            activeRecipe.subjectPop * 0.005
                          }) 0%, transparent 85%)`,
                        }}
                      />
                    )}

                    {/* Vignette Layer */}
                    {activeRecipe.vignette !== 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${
                            Math.abs(activeRecipe.vignette) * 0.007
                          }) 100%)`,
                        }}
                      />
                    )}

                    {/* Film Grain Texture */}
                    {activeRecipe.grain > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${
                            activeRecipe.grain * 0.01
                          }'/%3E%3C/svg%3E")`,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  // Split Screen Comparison View
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-150 flex items-center justify-center"
                    style={{
                      clipPath: `polygon(${splitPos}% 0, 100% 0, 100% 100%, ${splitPos}% 100%)`,
                      filter: filterString,
                      opacity: isHoldingSpace ? 0 : 1,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPhoto.src}
                      alt={currentPhoto.title}
                      className="block max-w-full max-h-[calc(100vh-100px)] w-auto h-auto object-contain"
                    />

                    {/* Synthetic Bokeh on Split Right Side */}
                    {activeRecipe.focusEnabled && effectiveBlurPx > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none transition-all"
                        style={{
                          backdropFilter: `blur(${effectiveBlurPx}px)`,
                          maskImage: maskGradient,
                          WebkitMaskImage: maskGradient,
                        }}
                      />
                    )}

                    {/* Vignette */}
                    {activeRecipe.vignette !== 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${
                            Math.abs(activeRecipe.vignette) * 0.007
                          }) 100%)`,
                        }}
                      />
                    )}

                    {/* Film Grain */}
                    {activeRecipe.grain > 0 && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${
                            activeRecipe.grain * 0.01
                          }'/%3E%3C/svg%3E")`,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* ── INTERACTIVE DRAGGABLE CROP BOX (In Crop Tab Mode) ── */}
              {activeTab === "crop" && (
                <div className="absolute inset-0 z-30 pointer-events-auto select-none">
                  {/* Outside Scrim Shadows */}
                  <div
                    className="absolute inset-x-0 top-0 bg-black/60 backdrop-blur-xs pointer-events-none"
                    style={{ height: `${currentCrop.y}%` }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs pointer-events-none"
                    style={{ height: `${100 - (currentCrop.y + currentCrop.height)}%` }}
                  />
                  <div
                    className="absolute left-0 bg-black/60 backdrop-blur-xs pointer-events-none"
                    style={{
                      top: `${currentCrop.y}%`,
                      height: `${currentCrop.height}%`,
                      width: `${currentCrop.x}%`,
                    }}
                  />
                  <div
                    className="absolute right-0 bg-black/60 backdrop-blur-xs pointer-events-none"
                    style={{
                      top: `${currentCrop.y}%`,
                      height: `${currentCrop.height}%`,
                      width: `${100 - (currentCrop.x + currentCrop.width)}%`,
                    }}
                  />

                  {/* The Draggable Crop Box Itself */}
                  <div
                    className="absolute border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move group"
                    style={{
                      left: `${currentCrop.x}%`,
                      top: `${currentCrop.y}%`,
                      width: `${currentCrop.width}%`,
                      height: `${currentCrop.height}%`,
                    }}
                    onMouseDown={(e) => handleCropHandleMouseDown("move", e)}
                  >
                    {/* 3x3 Rule-of-Thirds Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                      <div className="border-r border-b border-amber-400/30" />
                      <div className="border-r border-b border-amber-400/30" />
                      <div className="border-b border-amber-400/30" />
                      <div className="border-r border-b border-amber-400/30" />
                      <div className="border-r border-b border-amber-400/30" />
                      <div className="border-b border-amber-400/30" />
                      <div className="border-r border-b border-amber-400/30" />
                      <div className="border-r border-b border-amber-400/30" />
                      <div />
                    </div>

                    {/* 4 Draggable Corner Handles */}
                    <div
                      className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-amber-400 bg-amber-400/20 cursor-nwse-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("nw", e)}
                    />
                    <div
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-amber-400 bg-amber-400/20 cursor-nesw-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("ne", e)}
                    />
                    <div
                      className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-amber-400 bg-amber-400/20 cursor-nesw-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("sw", e)}
                    />
                    <div
                      className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-amber-400 bg-amber-400/20 cursor-nwse-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("se", e)}
                    />

                    {/* 4 Draggable Edge Handles */}
                    <div
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-amber-400 rounded-xs cursor-ns-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("n", e)}
                    />
                    <div
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-amber-400 rounded-xs cursor-ns-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("s", e)}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 bg-amber-400 rounded-xs cursor-ew-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("w", e)}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-amber-400 rounded-xs cursor-ew-resize hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleCropHandleMouseDown("e", e)}
                    />

                    <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-amber-400 border border-amber-400/30 pointer-events-none">
                      {currentCrop.width}% × {currentCrop.height}%
                    </span>
                  </div>

                  {/* Floating Action Bar directly on Canvas */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/90 backdrop-blur-md p-1.5 px-3 rounded-full border border-amber-400/40 shadow-2xl">
                    <button
                      onClick={handleResetCrop}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                    <div className="h-3.5 w-px bg-neutral-700" />
                    <button
                      onClick={handleApplyCrop}
                      className="px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Apply Crop</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── INTERACTIVE DRAGGABLE FOCUS TARGET RETICLE ── */}
              {activeTab === "focus" && (
                <div
                  className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform cursor-grab active:cursor-grabbing select-none"
                  style={{
                    left: `${activeRecipe.focalPoint.x}%`,
                    top: `${activeRecipe.focalPoint.y}%`,
                  }}
                  onMouseDown={handleFocalReticleMouseDown}
                >
                  <div
                    className="border border-dashed border-amber-400/70 rounded-full flex items-center justify-center pointer-events-none"
                    style={{
                      width: `${(activeRecipe.clearZoneRadius || 36) * 3.5}px`,
                      height: `${(activeRecipe.clearZoneRadius || 36) * 4.8}px`,
                    }}
                  >
                    <div className="w-9 h-9 rounded-full border-2 border-amber-400 bg-amber-400/20 shadow-xl flex items-center justify-center hover:scale-110 transition-transform">
                      <Focus className="h-5 w-5 text-amber-400 animate-pulse" />
                    </div>
                  </div>

                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap bg-black/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 border border-amber-400/40 shadow-lg pointer-events-none">
                    f/{activeRecipe.aperture} • Drag into position
                  </span>
                </div>
              )}

              {/* AI Scanning Beam Effect */}
              {isScanningAI && (
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                  <motion.div
                    initial={{ top: "-10%" }}
                    animate={{ top: "110%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-x-0 h-2 bg-gradient-to-b from-amber-400 to-transparent shadow-[0_0_20px_#f59e0b]"
                  />
                  <div className="absolute inset-0 bg-amber-500/10 backdrop-blur-xs flex items-center justify-center">
                    <div className="bg-black/80 px-4 py-2 rounded-xl border border-amber-400/40 text-amber-400 font-mono text-xs flex items-center gap-2 shadow-2xl">
                      <Scan className="h-4 w-4 animate-spin" />
                      <span>Analyzing Scene...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Detected Subject Box Indicator */}
              {activeTab === "ai" && showSubjectBox && currentPhoto.detectedSubjectBox && !isScanningAI && (
                <div
                  className="absolute border-2 border-dashed border-amber-400/70 pointer-events-none z-20 rounded-md transition-all"
                  style={{
                    left: `${currentPhoto.detectedSubjectBox.x * 100}%`,
                    top: `${currentPhoto.detectedSubjectBox.y * 100}%`,
                    width: `${currentPhoto.detectedSubjectBox.w * 100}%`,
                    height: `${currentPhoto.detectedSubjectBox.h * 100}%`,
                  }}
                >
                  <span className="absolute -top-5 left-1 text-[9px] font-mono uppercase tracking-widest bg-amber-400 text-black px-1.5 py-0.5 rounded font-bold">
                    Subject Focal Zone
                  </span>
                </div>
              )}

              {/* Split Slider Divider Line & Drag Handle */}
              {viewMode === "split" && !isHoldingSpace && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-auto cursor-ew-resize group"
                  style={{ left: `${splitPos}%`, transform: "translateX(-50%)" }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsDraggingSplit(true)
                  }}
                >
                  <div className="w-0.5 h-full bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.8)]" />
                  <div className="absolute top-1/2 -translate-y-1/2 -left-3.5 w-7 h-7 rounded-full bg-white text-black shadow-xl flex items-center justify-center text-[10px] font-bold ring-2 ring-black/40 group-hover:scale-110 transition-transform">
                    <SplitSquareVertical className="h-3.5 w-3.5" />
                  </div>
                  <span className="absolute bottom-3 right-3 text-[9px] uppercase tracking-widest font-mono bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-neutral-300 pointer-events-none">
                    Edited ({100 - splitPos}%)
                  </span>
                  <span className="absolute bottom-3 left-3 text-[9px] uppercase tracking-widest font-mono bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-neutral-300 pointer-events-none -translate-x-full">
                    Original ({splitPos}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── Right Inspector & Adjustments Panel ── */}
        <aside
          className={cn(
            "bg-[#121215] border-l border-neutral-800 flex flex-col shrink-0 z-20 h-full overflow-hidden transition-all duration-200",
            isInspectorOpen ? "w-80 sm:w-88 lg:w-96" : "w-0 border-l-0"
          )}
        >
          <div className="w-80 sm:w-88 lg:w-96 h-full flex flex-col min-h-0 overflow-hidden">
            {/* Inspector Tabs Header */}
            <div className="grid grid-cols-6 border-b border-neutral-800 p-1 bg-neutral-900/60 text-xs shrink-0">
              <button
                onClick={() => setActiveTab("ai")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "ai"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px]">AI Director</span>
              </button>

              <button
                onClick={() => setActiveTab("light")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "light"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Sun className="h-4 w-4" />
                <span className="text-[10px]">Light</span>
              </button>

              <button
                onClick={() => setActiveTab("color")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "color"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Palette className="h-4 w-4" />
                <span className="text-[10px]">Color</span>
              </button>

              <button
                onClick={() => setActiveTab("focus")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "focus"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Aperture className="h-4 w-4" />
                <span className="text-[10px]">Focus</span>
              </button>

              <button
                onClick={() => setActiveTab("crop")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "crop"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Crop className="h-4 w-4" />
                <span className="text-[10px]">Crop</span>
              </button>

              <button
                onClick={() => setActiveTab("effects")}
                className={cn(
                  "py-2 flex flex-col items-center gap-1 rounded-md font-semibold transition-all cursor-pointer",
                  activeTab === "effects"
                    ? "bg-amber-500/10 text-amber-400 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Film className="h-4 w-4" />
                <span className="text-[10px]">Detail</span>
              </button>
            </div>

            {/* Inspector Content Scroll Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-12 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 overscroll-contain">
              {/* ── TAB 1: AI DIRECTOR & CONTENT REVIEW ── */}
              {activeTab === "ai" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  {/* Client Note Card */}
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 fill-amber-400" /> Client Star Note
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">Proofing Review</span>
                    </div>
                    <p className="text-xs text-neutral-300 italic">{currentPhoto.clientNote}</p>
                  </div>

                  {/* AI Scene Analysis Card */}
                  <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-oswald">
                          Content-Aware Critique
                        </h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          currentPhoto.aiSource === "gemini"
                            ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                            : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        )}
                      >
                        {currentPhoto.aiSource === "gemini" ? "Gemini 2.0 Vision 🤖" : "Smart Salience ⚡"}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase text-neutral-400 tracking-wider">
                        Detected Scene
                      </span>
                      <p className="text-xs font-semibold text-neutral-100">{currentPhoto.aiAnalysis.sceneType}</p>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed border-t border-neutral-800/80 pt-2.5">
                      {currentPhoto.aiAnalysis.critique}
                    </p>

                    <div className="border-t border-neutral-800/80 pt-2.5 space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase text-amber-400/90 tracking-wider block">
                        Recommended Best-Practice Fixes:
                      </span>
                      {currentPhoto.aiAnalysis.bestPracticeFixes.map((fix, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-xs text-neutral-300">
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{fix}</span>
                        </div>
                      ))}
                    </div>

                    {/* Re-Scan Action Button */}
                    <div className="border-t border-neutral-800/80 pt-2.5 flex items-center justify-between">
                      <button
                        onClick={() => setShowSubjectBox(!showSubjectBox)}
                        className="text-[10px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>{showSubjectBox ? "Hide Subject Box" : "Show Subject Box"}</span>
                      </button>

                      <button
                        disabled={isScanningAI}
                        onClick={handleScanWithAI}
                        className="text-[10px] text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Zap className="h-3 w-3" />
                        <span>Deep Re-Scan Scene</span>
                      </button>
                    </div>
                  </div>

                  {/* Creative Vibes Selector */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-oswald flex items-center justify-between">
                      <span>Diverse Creative Proposals</span>
                      <span className="text-[10px] text-neutral-500 font-normal">Click to apply</span>
                    </h4>

                    <div className="space-y-2">
                      {currentPhoto.aiAnalysis.vibes.map((vibe, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleApplyVibe(vibe.recipe, vibe.name)}
                          className="w-full rounded-xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-amber-500/50 p-3 text-left transition-all group flex items-center justify-between cursor-pointer"
                        >
                          <div className="space-y-0.5 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{vibe.icon}</span>
                              <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                                {vibe.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400">{vibe.tagline}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TAB 2: LIGHT & TONE CURVE GRAPH ── */}
              {activeTab === "light" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  {/* Interactive Tone Curve Component */}
                  <ToneCurveEditor
                    points={activeRecipe.curvePoints || DEFAULT_CURVE_POINTS}
                    onChange={(newPoints) => updateRecipe({ curvePoints: newPoints })}
                    channel={activeRecipe.curveChannel || "rgb"}
                    onChannelChange={(ch) => updateRecipe({ curveChannel: ch })}
                  />

                  <div className="flex items-center justify-between pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Light & Tonal Sliders
                    </h4>
                    <button
                      onClick={() =>
                        updateRecipe({
                          exposure: 0,
                          contrast: 0,
                          highlights: 0,
                          shadows: 0,
                          whites: 0,
                          blacks: 0,
                          curvePoints: [...DEFAULT_CURVE_POINTS],
                        })
                      }
                      className="text-[10px] text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      Reset Light
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Exposure</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.exposure > 0 ? `+${activeRecipe.exposure}` : activeRecipe.exposure} EV
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.05"
                      value={activeRecipe.exposure}
                      onChange={(e) => updateRecipe({ exposure: parseFloat(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Contrast</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.contrast > 0 ? `+${activeRecipe.contrast}` : activeRecipe.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.contrast}
                      onChange={(e) => updateRecipe({ contrast: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Highlights (Fully Functional Live LUT) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400 flex items-center gap-1.5">
                        <Sun className="h-3.5 w-3.5 text-amber-400" />
                        <span>Highlights (Recover / Boost)</span>
                      </span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.highlights > 0 ? `+${activeRecipe.highlights}` : activeRecipe.highlights}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.highlights}
                      onChange={(e) => updateRecipe({ highlights: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Tones down blown-out skies and bright clothes or boosts highlight punch.
                    </p>
                  </div>

                  {/* Shadows (Fully Functional Live LUT) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-amber-400" />
                        <span>Shadows (Lift / Crush)</span>
                      </span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.shadows > 0 ? `+${activeRecipe.shadows}` : activeRecipe.shadows}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.shadows}
                      onChange={(e) => updateRecipe({ shadows: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Recovers dark subject detail without washing out pure blacks.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Whites (Clipping Point)</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.whites > 0 ? `+${activeRecipe.whites}` : activeRecipe.whites}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.whites}
                      onChange={(e) => updateRecipe({ whites: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Blacks (Shadow Floor)</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.blacks > 0 ? `+${activeRecipe.blacks}` : activeRecipe.blacks}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.blacks}
                      onChange={(e) => updateRecipe({ blacks: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ── TAB 3: COLOR & TEMPERATURE ── */}
              {activeTab === "color" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Color & Temperature
                    </h4>
                    <button
                      onClick={() => updateRecipe({ temp: 0, tint: 0, vibrance: 0, saturation: 0 })}
                      className="text-[10px] text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      Reset (0K Neutral)
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Temperature (Kelvin)</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.temp > 0
                          ? `+${activeRecipe.temp} Warm`
                          : activeRecipe.temp < 0
                          ? `${activeRecipe.temp} Cool`
                          : "0K (Natural Neutral)"}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={activeRecipe.temp}
                        onChange={(e) => updateRecipe({ temp: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-2 rounded-lg cursor-pointer bg-gradient-to-r from-blue-600 via-neutral-600 to-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Tint</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.tint > 0
                          ? `+${activeRecipe.tint} Magenta`
                          : activeRecipe.tint < 0
                          ? `${activeRecipe.tint} Green`
                          : "0"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.tint}
                      onChange={(e) => updateRecipe({ tint: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-2 rounded-lg cursor-pointer bg-gradient-to-r from-emerald-600 via-neutral-600 to-fuchsia-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Vibrance</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.vibrance > 0 ? `+${activeRecipe.vibrance}` : activeRecipe.vibrance}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.vibrance}
                      onChange={(e) => updateRecipe({ vibrance: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Saturation</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.saturation > 0 ? `+${activeRecipe.saturation}` : activeRecipe.saturation}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={activeRecipe.saturation}
                      onChange={(e) => updateRecipe({ saturation: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ── TAB 4: FOCUS & DRAGGABLE OPTICAL DEPTH ── */}
              {activeTab === "focus" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Natural Optical Depth
                    </h4>
                    <button
                      onClick={() => updateRecipe({ focusEnabled: !activeRecipe.focusEnabled })}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer",
                        activeRecipe.focusEnabled
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-neutral-800 text-neutral-400"
                      )}
                    >
                      {activeRecipe.focusEnabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {/* Interactive Drag Hint Box */}
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2.5 text-xs text-amber-300">
                    <Focus className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                    <span>
                      <strong>Interactive Focus:</strong> Drag the reticle or click directly on the image to place focus.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-neutral-400 block">Simulated Lens Aperture</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1.4, 1.8, 2.0, 2.8, 4.0, 5.6, 8.0, 16].map((f) => (
                        <button
                          key={f}
                          onClick={() => updateRecipe({ aperture: f, focusEnabled: true })}
                          className={cn(
                            "py-1.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer",
                            activeRecipe.aperture === f && activeRecipe.focusEnabled
                              ? "bg-amber-400 text-black border-amber-400"
                              : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                          )}
                        >
                          f/{f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Smile className="h-3.5 w-3.5 text-amber-400" />
                        <span>Subject Protection Zone</span>
                      </span>
                      <span className="font-mono text-amber-400">{activeRecipe.clearZoneRadius || 36}%</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="65"
                      step="2"
                      value={activeRecipe.clearZoneRadius || 36}
                      onChange={(e) => updateRecipe({ clearZoneRadius: parseInt(e.target.value), focusEnabled: true })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Keeps the person&apos;s entire hair, shoulders, and body completely in focus.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Background Blur Softness</span>
                      <span className="font-mono text-amber-400">{activeRecipe.blurRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={activeRecipe.blurRadius}
                      onChange={(e) => updateRecipe({ blurRadius: parseFloat(e.target.value), focusEnabled: true })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Subject Luminance Pop</span>
                      <span className="font-mono text-amber-400">+{activeRecipe.subjectPop}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="2"
                      value={activeRecipe.subjectPop}
                      onChange={(e) => updateRecipe({ subjectPop: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ── TAB 5: CROP & CUSTOM DRAG CROPPING ── */}
              {activeTab === "crop" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Aspect Ratio & Custom Crop
                    </h4>
                    <button
                      onClick={handleResetCrop}
                      className="text-[10px] text-neutral-400 hover:text-amber-400 cursor-pointer"
                    >
                      Reset Full Frame
                    </button>
                  </div>

                  {/* Apply Crop Prominent Button */}
                  <button
                    onClick={handleApplyCrop}
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Check className="h-4 w-4" />
                    <span>Apply & Commit Crop</span>
                  </button>

                  {/* Interactive Crop Drag Hint */}
                  <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-3 space-y-1.5">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Move className="h-3.5 w-3.5" />
                      <span>Custom Drag Crop Active</span>
                    </span>
                    <p className="text-[11px] text-neutral-300">
                      Drag the corners, edges, or center of the gold crop frame directly on the image to crop. Press <strong>Enter</strong> or click <strong>Apply Crop</strong> when done.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-neutral-400 block">Crop Aspect Ratio Preset</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "Freeform (Drag)", value: "custom" },
                        { label: "Original (Full)", value: "original" },
                        { label: "4:5 Portrait", value: "4:5" },
                        { label: "1:1 Square", value: "1:1" },
                        { label: "9:16 Story", value: "9:16" },
                        { label: "16:9 Cinema", value: "16:9" },
                        { label: "2:3 Classic", value: "2:3" },
                        { label: "3:2 Landscape", value: "3:2" },
                      ].map((ratio) => (
                        <button
                          key={ratio.value}
                          onClick={() => handleSelectAspectRatio(ratio.value as any)}
                          className={cn(
                            "py-2 px-1 rounded text-[11px] font-semibold border transition-all text-center cursor-pointer",
                            activeRecipe.aspectRatio === ratio.value
                              ? "bg-amber-400 text-black border-amber-400 font-bold"
                              : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                          )}
                        >
                          {ratio.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rotate & Flip Orientation Tools */}
                  <div className="space-y-2 pt-2 border-t border-neutral-800">
                    <span className="text-xs font-medium text-neutral-400 block">Rotate & Orientation</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={handleRotateCCW}
                        className="py-2 px-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Rotate 90° Counter-Clockwise"
                      >
                        <RotateCcw className="h-4 w-4 text-amber-400" />
                        <span className="text-[10px] font-medium">-90°</span>
                      </button>
                      <button
                        onClick={handleRotateCW}
                        className="py-2 px-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="h-4 w-4 text-amber-400" />
                        <span className="text-[10px] font-medium">+90°</span>
                      </button>
                      <button
                        onClick={handleFlipH}
                        className={cn(
                          "py-2 px-1 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                          activeRecipe.flipH
                            ? "bg-amber-400/20 text-amber-400 border-amber-400/50"
                            : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800"
                        )}
                        title="Flip Horizontal (Mirror)"
                      >
                        <FlipHorizontal className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Flip H</span>
                      </button>
                      <button
                        onClick={handleFlipV}
                        className={cn(
                          "py-2 px-1 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                          activeRecipe.flipV
                            ? "bg-amber-400/20 text-amber-400 border-amber-400/50"
                            : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800"
                        )}
                        title="Flip Vertical"
                      >
                        <FlipVertical className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Flip V</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Straighten / Horizon Angle</span>
                      <span className="font-mono text-amber-400">
                        {activeRecipe.straighten > 0 ? `+${activeRecipe.straighten}°` : `${activeRecipe.straighten}°`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="0.5"
                      value={activeRecipe.straighten}
                      onChange={(e) => updateRecipe({ straighten: parseFloat(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ── TAB 6: SHARPENING, DETAIL & EFFECTS ── */}
              {activeTab === "effects" && (
                <div className="space-y-5 animate-in fade-in-50 duration-200 pb-10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Sharpening & Micro-Detail
                    </h4>
                    <button
                      onClick={() =>
                        updateRecipe({
                          sharpening: 0,
                          sharpenRadius: 1.0,
                          sharpenMasking: 0,
                          grain: 0,
                          vignette: 0,
                          clarity: 0,
                        })
                      }
                      className="text-[10px] text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      Reset Detail
                    </button>
                  </div>

                  {/* Sharpening Amount */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>Edge Sharpening</span>
                      </span>
                      <span className="font-mono text-amber-400">+{activeRecipe.sharpening || 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="2"
                      value={activeRecipe.sharpening || 0}
                      onChange={(e) => updateRecipe({ sharpening: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Enhances fine edge acutance on eyelashes, jewelry, hair, and clothing textures.
                    </p>
                  </div>

                  {/* Sharpening Radius */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400">Sharpening Radius</span>
                      <span className="font-mono text-amber-400">{activeRecipe.sharpenRadius || 1.0} px</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={activeRecipe.sharpenRadius || 1.0}
                      onChange={(e) => updateRecipe({ sharpenRadius: parseFloat(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Edge Masking */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Smile className="h-3.5 w-3.5 text-amber-400" />
                        <span>Skin Edge Masking</span>
                      </span>
                      <span className="font-mono text-amber-400">{activeRecipe.sharpenMasking || 20}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={activeRecipe.sharpenMasking || 20}
                      onChange={(e) => updateRecipe({ sharpenMasking: parseInt(e.target.value) })}
                      className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400">
                      Restricts sharpening to strong subject edges, protecting silky smooth skin tones.
                    </p>
                  </div>

                  <div className="border-t border-neutral-800/80 pt-3 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                      Texture & Analog Film
                    </h4>

                    {/* Clarity */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Clarity / Micro-Texture</span>
                        <span className="font-mono text-amber-400">+{activeRecipe.clarity}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="2"
                        value={activeRecipe.clarity}
                        onChange={(e) => updateRecipe({ clarity: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Film Grain */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Analog Film Grain (ISO)</span>
                        <span className="font-mono text-amber-400">{activeRecipe.grain}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        step="2"
                        value={activeRecipe.grain}
                        onChange={(e) => updateRecipe({ grain: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Vignette */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Vignette</span>
                        <span className="font-mono text-amber-400">{activeRecipe.vignette}</span>
                      </div>
                      <input
                        type="range"
                        min="-80"
                        max="80"
                        step="2"
                        value={activeRecipe.vignette}
                        onChange={(e) => updateRecipe({ vignette: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── API Key Modal ── */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#16161a] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-oswald uppercase">
                    Gemini Multimodal Vision API
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Optional: Connect your Gemini API key for deep semantic scene critique.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-300 font-medium">Google AI / Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400 font-mono"
                />
                <p className="text-[11px] text-neutral-400">
                  Leave empty to use the built-in instant local salience & histogram engine.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowApiKeyModal(false)
                    if (geminiApiKey) toast.success("Gemini API key saved for this session! ✨")
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold transition-colors cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Batch Sync Modal ── */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#16161a] border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-oswald uppercase">
                    Batch Apply AI Edits
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Synchronize this look across all {photoList.length} photos in the queue.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900/80 p-3.5 border border-neutral-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Active Recipe:</span>
                  <span className="font-bold text-amber-400">{currentPhoto.aiAnalysis.vibes[0].name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Target Queue:</span>
                  <span className="text-neutral-200">{photoList.length} Photos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Aperture Depth:</span>
                  <span className="text-neutral-200">f/{activeRecipe.aperture} (Subject Protected)</span>
                </div>
              </div>

              {batchProgress !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Processing high-res masters...</span>
                    <span className="font-mono text-amber-400">{batchProgress}%</span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${batchProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  disabled={batchProgress !== null}
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={batchProgress !== null}
                  onClick={handleRunBatchSync}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {batchProgress !== null ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Syncing Batch...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Start Batch Sync</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
