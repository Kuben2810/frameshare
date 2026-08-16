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
  Save,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ToneCurveEditor } from "@/components/prototype/tone-curve-editor"
import {
  CurvePoint,
  DEFAULT_CURVE_POINTS,
  generateToneLutString,
} from "@/lib/tone-curve"
import {
  PhotoEditRecipe,
  CropRect,
  DEFAULT_CROP_BOX,
  DEFAULT_PHOTO_RECIPE,
  PhotoAIAnalysis,
} from "@/lib/ai-photo-analyzer"
import {
  savePhotoEditAction,
  batchSavePhotoEditsAction,
} from "@/app/actions/galleries"

export interface StudioPhotoItem {
  id: string
  title: string
  filename: string
  src: string
  originalKey: string
  stars: number
  comments: string[]
  isStarred: boolean
  isSelectedInSession?: boolean
  isRaw?: boolean
  width: number
  height: number
  aspectRatio: "3:2" | "2:3"
  savedEditRecipe?: PhotoEditRecipe | null
}

interface StudioShellProps {
  gallery: {
    id: string
    name: string
    slug: string
    stage: string
  }
  initialPhotos: StudioPhotoItem[]
  initialFilter?: "all" | "starred"
  initialPhotoId?: string
  selectionCount: number
}

export function StudioShell({
  gallery,
  initialPhotos,
  initialFilter = "all",
  initialPhotoId,
  selectionCount,
}: StudioShellProps) {
  const filterId = useId().replace(/:/g, "")
  const [filterMode, setFilterMode] = useState<"all" | "starred">(initialFilter)
  const [photosList, setPhotosList] = useState<StudioPhotoItem[]>(initialPhotos)

  // Filtered list
  const activePhotos = photosList.filter((p) => {
    if (filterMode === "starred") return p.isStarred || p.isSelectedInSession
    return true
  })

  // Selected photo index
  const initialIndex = initialPhotoId
    ? Math.max(
        0,
        activePhotos.findIndex((p) => p.id === initialPhotoId)
      )
    : 0
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(
    initialIndex !== -1 ? initialIndex : 0
  )

  const currentPhoto = activePhotos[selectedPhotoIdx] || activePhotos[0]

  // Edit recipes dictionary (keyed by photoId)
  const [recipes, setRecipes] = useState<Record<string, PhotoEditRecipe>>(() => {
    const initialDict: Record<string, PhotoEditRecipe> = {}
    initialPhotos.forEach((p) => {
      initialDict[p.id] = p.savedEditRecipe
        ? { ...DEFAULT_PHOTO_RECIPE, ...p.savedEditRecipe }
        : { ...DEFAULT_PHOTO_RECIPE }
    })
    return initialDict
  })

  const activeRecipe = (currentPhoto && recipes[currentPhoto.id]) || DEFAULT_PHOTO_RECIPE

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<
    "ai" | "light" | "color" | "focus" | "crop" | "effects"
  >("ai")
  const [viewMode, setViewMode] = useState<"split" | "edited">("split")
  const [splitPos, setSplitPos] = useState(50)
  const [isHoldingSpace, setIsHoldingSpace] = useState(false)
  const [showSubjectBox, setShowSubjectBox] = useState(false)
  const [isLeftFilmstripOpen, setIsLeftFilmstripOpen] = useState(true)
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState(true)

  // Interaction dragging states
  const [isDraggingFocalPoint, setIsDraggingFocalPoint] = useState(false)
  const [isDraggingCropHandle, setIsDraggingCropHandle] = useState<string | null>(null)
  const [cropDragStart, setCropDragStart] = useState<{
    startX: number
    startY: number
    startBox: CropRect
  } | null>(null)
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)

  // Async server saving states
  const [isSavingFinal, setIsSavingFinal] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [isScanningAI, setIsScanningAI] = useState(false)

  // API Key modal
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [geminiApiKey, setGeminiApiKey] = useState("")

  const photoFrameRef = useRef<HTMLDivElement>(null)

  // Update recipe helper
  const updateRecipe = useCallback(
    (updates: Partial<PhotoEditRecipe>) => {
      if (!currentPhoto) return
      setRecipes((prev) => ({
        ...prev,
        [currentPhoto.id]: {
          ...(prev[currentPhoto.id] || DEFAULT_PHOTO_RECIPE),
          ...updates,
        },
      }))
    },
    [currentPhoto]
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault()
        setIsHoldingSpace(true)
      }
      if (e.code === "Enter" && activeTab === "crop") {
        e.preventDefault()
        handleApplyCrop()
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault()
        setSelectedPhotoIdx((prev) => Math.max(0, prev - 1))
      }
      if (e.code === "ArrowRight") {
        e.preventDefault()
        setSelectedPhotoIdx((prev) => Math.min(activePhotos.length - 1, prev + 1))
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
  }, [activeTab, activePhotos.length])

  // Crop Handlers
  const currentCrop = activeRecipe.cropBox || DEFAULT_CROP_BOX
  const isCustomCropped =
    activeRecipe.isCropCommitted ||
    currentCrop.x > 0 ||
    currentCrop.y > 0 ||
    currentCrop.width < 100 ||
    currentCrop.height < 100

  function handleSelectAspectRatio(
    ratio: "original" | "custom" | "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "3:2"
  ) {
    if (ratio === "original" || ratio === "custom") {
      updateRecipe({ aspectRatio: ratio })
      return
    }

    let w = 85
    let h = 85
    if (ratio === "1:1") {
      w = 75
      h = 75
    } else if (ratio === "4:5") {
      w = 68
      h = 85
    } else if (ratio === "9:16") {
      w = 50
      h = 88
    } else if (ratio === "16:9") {
      w = 90
      h = 50
    } else if (ratio === "2:3") {
      w = 60
      h = 90
    } else if (ratio === "3:2") {
      w = 90
      h = 60
    }

    const x = Math.round((100 - w) / 2)
    const y = Math.round((100 - h) / 2)
    updateRecipe({
      aspectRatio: ratio,
      cropBox: { x, y, width: w, height: h },
    })
    toast.info(`Set crop ratio to ${ratio}`)
  }

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

  // Rotation & Flips
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
      setPhotosList((prev) =>
        prev.map((p) =>
          p.id === currentPhoto.id
            ? { ...p, src: newUrl, aspectRatio: canvas.width > canvas.height ? "3:2" : "2:3" }
            : p
        )
      )
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
      setPhotosList((prev) =>
        prev.map((p) =>
          p.id === currentPhoto.id
            ? { ...p, src: newUrl, aspectRatio: canvas.width > canvas.height ? "3:2" : "2:3" }
            : p
        )
      )
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
      setPhotosList((prev) =>
        prev.map((p) => (p.id === currentPhoto.id ? { ...p, src: newUrl } : p))
      )
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
      setPhotosList((prev) =>
        prev.map((p) => (p.id === currentPhoto.id ? { ...p, src: newUrl } : p))
      )
      toast.success("Flipped Vertical")
    } catch {
      toast.error("Failed to flip image")
    }
  }

  // Focal Point Drag
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
    toast.info(`Focused on point (${x}%, ${y}%)`)
  }

  // Global mousemove/mouseup listener for dragging
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!photoFrameRef.current) return
      const rect = photoFrameRef.current.getBoundingClientRect()

      if (isDraggingFocalPoint) {
        const x = Math.max(
          0,
          Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100))
        )
        const y = Math.max(
          0,
          Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100))
        )
        updateRecipe({ focalPoint: { x, y } })
      } else if (isDraggingSplit) {
        const x = Math.max(
          5,
          Math.min(95, Math.round(((e.clientX - rect.left) / rect.width) * 100))
        )
        setSplitPos(x)
      } else if (isDraggingCropHandle && cropDragStart) {
        const deltaX = ((e.clientX - cropDragStart.startX) / rect.width) * 100
        const deltaY = ((e.clientY - cropDragStart.startY) / rect.height) * 100
        const b = cropDragStart.startBox
        let newX = b.x
        let newY = b.y
        let newW = b.width
        let newH = b.height

        if (isDraggingCropHandle === "move") {
          newX = Math.max(0, Math.min(100 - b.width, Math.round(b.x + deltaX)))
          newY = Math.max(0, Math.min(100 - b.height, Math.round(b.y + deltaY)))
        } else if (isDraggingCropHandle === "se") {
          newW = Math.max(15, Math.min(100 - b.x, Math.round(b.width + deltaX)))
          newH = Math.max(15, Math.min(100 - b.y, Math.round(b.height + deltaY)))
        } else if (isDraggingCropHandle === "sw") {
          const maxLeft = b.x + b.width - 15
          newX = Math.max(0, Math.min(maxLeft, Math.round(b.x + deltaX)))
          newW = b.width + (b.x - newX)
          newH = Math.max(15, Math.min(100 - b.y, Math.round(b.height + deltaY)))
        } else if (isDraggingCropHandle === "ne") {
          const maxTop = b.y + b.height - 15
          newY = Math.max(0, Math.min(maxTop, Math.round(b.y + deltaY)))
          newH = b.height + (b.y - newY)
          newW = Math.max(15, Math.min(100 - b.x, Math.round(b.width + deltaX)))
        } else if (isDraggingCropHandle === "nw") {
          const maxLeft = b.x + b.width - 15
          const maxTop = b.y + b.height - 15
          newX = Math.max(0, Math.min(maxLeft, Math.round(b.x + deltaX)))
          newY = Math.max(0, Math.min(maxTop, Math.round(b.y + deltaY)))
          newW = b.width + (b.x - newX)
          newH = b.height + (b.y - newY)
        }

        updateRecipe({
          cropBox: { x: newX, y: newY, width: newW, height: newH },
        })
      }
    }

    function handleMouseUp() {
      setIsDraggingFocalPoint(false)
      setIsDraggingSplit(false)
      setIsDraggingCropHandle(null)
      setCropDragStart(null)
    }

    if (isDraggingFocalPoint || isDraggingSplit || isDraggingCropHandle) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [
    isDraggingFocalPoint,
    isDraggingSplit,
    isDraggingCropHandle,
    cropDragStart,
    updateRecipe,
  ])

  // Server Save Handlers
  async function handleSaveDraft() {
    if (!currentPhoto) return
    setIsSavingDraft(true)
    try {
      const res = await savePhotoEditAction(
        gallery.id,
        currentPhoto.id,
        activeRecipe,
        false
      )
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Saved recipe draft to photo!")
      }
    } catch {
      toast.error("Failed to save edit")
    } finally {
      setIsSavingDraft(false)
    }
  }

  async function handleSaveFinalDelivery() {
    if (!currentPhoto) return
    setIsSavingFinal(true)
    toast.info("Rendering high-res master & publishing to Final Delivery...")
    try {
      const res = await savePhotoEditAction(
        gallery.id,
        currentPhoto.id,
        activeRecipe,
        true
      )
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("✨ High-res master published to Final Delivery!")
      }
    } catch {
      toast.error("Failed to render and publish final photo")
    } finally {
      setIsSavingFinal(false)
    }
  }

  async function handleBatchPublish(saveAsFinal: boolean) {
    setIsBatchProcessing(true)
    const targetIds = activePhotos.map((p) => p.id)
    toast.info(
      saveAsFinal
        ? `Rendering and publishing ${targetIds.length} photos to Final Delivery...`
        : `Syncing edit recipe across ${targetIds.length} photos...`
    )
    try {
      const res = await batchSavePhotoEditsAction(
        gallery.id,
        targetIds,
        activeRecipe,
        saveAsFinal
      )
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success(`✨ Successfully processed ${targetIds.length} photos!`)
        setIsBatchModalOpen(false)
      }
    } catch {
      toast.error("Batch processing failed")
    } finally {
      setIsBatchProcessing(false)
    }
  }

  // Client Download High-Res Master
  async function handleExportDownload() {
    if (!currentPhoto) return
    toast.info("Generating high-resolution master...")
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = currentPhoto.src
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
      })

      const naturalW = img.naturalWidth || 2000
      const naturalH = img.naturalHeight || 1500
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
      const s = Math.max(
        0,
        1 + (activeRecipe.saturation + activeRecipe.vibrance * 0.5) * 0.01
      )
      const sep = activeRecipe.temp > 0 ? activeRecipe.temp * 0.002 : 0
      const hr = activeRecipe.tint * 0.3

      ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${sep}) hue-rotate(${hr}deg)`
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      if (activeRecipe.vignette !== 0) {
        ctx.filter = "none"
        const grad = ctx.createRadialGradient(
          cropW / 2,
          cropH / 2,
          Math.min(cropW, cropH) * 0.3,
          cropW / 2,
          cropH / 2,
          Math.max(cropW, cropH) * 0.7
        )
        grad.addColorStop(0, "rgba(0,0,0,0)")
        grad.addColorStop(1, `rgba(0,0,0,${Math.abs(activeRecipe.vignette) * 0.008})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, cropW, cropH)
      }

      // Live Sharpening Convolution
      if ((activeRecipe.sharpening ?? 0) > 0) {
        try {
          const imgData = ctx.getImageData(0, 0, cropW, cropH)
          const data = imgData.data
          const copy = new Uint8ClampedArray(data)
          const k = ((activeRecipe.sharpening ?? 0) / 100) * 0.65
          const center = 1 + 4 * k

          for (let y = 1; y < cropH - 1; y++) {
            for (let x = 1; x < cropW - 1; x++) {
              const idx = (y * cropW + x) * 4
              const top = ((y - 1) * cropW + x) * 4
              const bottom = ((y + 1) * cropW + x) * 4
              const left = (y * cropW + (x - 1)) * 4
              const right = (y * cropW + (x + 1)) * 4

              for (let ch = 0; ch < 3; ch++) {
                const val =
                  copy[idx + ch] * center -
                  (copy[top + ch] + copy[bottom + ch] + copy[left + ch] + copy[right + ch]) * k
                data[idx + ch] = Math.max(0, Math.min(255, val))
              }
            }
          }
          ctx.putImageData(imgData, 0, 0)
        } catch {
          // ignore if cross origin
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
        toast.success(`✨ Downloaded master edit for "${currentPhoto.title}"!`)
      }, "image/jpeg", 0.95)
    } catch {
      toast.error("Failed to render export image")
    }
  }

  // Generate SVG Tone Curve LUT Table Values
  const rLutString = generateToneLutString({
    points: activeRecipe.curvePoints || DEFAULT_CURVE_POINTS,
    highlights: activeRecipe.highlights,
    shadows: activeRecipe.shadows,
    whites: activeRecipe.whites,
    blacks: activeRecipe.blacks,
    contrast: activeRecipe.contrast,
  })
  const gLutString = rLutString
  const bLutString = rLutString

  // CSS Filter calculations
  const brightness = 1 + activeRecipe.exposure * 0.4
  const saturate = Math.max(
    0,
    1 + (activeRecipe.saturation + activeRecipe.vibrance * 0.5) * 0.01
  )
  const sepia = activeRecipe.temp > 0 ? activeRecipe.temp * 0.002 : 0
  const hueRotate = activeRecipe.tint * 0.3

  const opticalFstopScale = Math.max(0, (1 / activeRecipe.aperture - 1 / 8) * 10)
  const effectiveBlurPx = activeRecipe.focusEnabled
    ? Math.min(activeRecipe.blurRadius, opticalFstopScale)
    : 0

  const clearRadius = activeRecipe.clearZoneRadius || 38
  const innerPercent = Math.max(10, Math.round(clearRadius * 0.65))
  const outerPercent = Math.min(100, Math.round(clearRadius * 1.45))
  const maskGradient = `radial-gradient(ellipse ${clearRadius * 1.1}% ${
    clearRadius * 1.5
  }% at ${activeRecipe.focalPoint.x}% ${activeRecipe.focalPoint.y}%, transparent ${innerPercent}%, rgba(0,0,0,0.5) ${clearRadius}%, black ${outerPercent}%)`

  const filterString = isHoldingSpace
    ? "none"
    : `url(#tone-lut-${filterId}) brightness(${brightness}) saturate(${saturate}) sepia(${sepia}) hue-rotate(${hueRotate}deg)`

  const sharpenK = ((activeRecipe.sharpening ?? 0) / 100) * 0.75

  const showCommittedCropView = activeTab !== "crop" && isCustomCropped

  if (!currentPhoto) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0c0c0e] text-neutral-400">
        <div className="text-center space-y-3">
          <p>No photos found in this section.</p>
          <Link href={`/dashboard/galleries/${gallery.id}`}>
            <Button variant="outline">Return to Gallery</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-screen h-screen max-h-screen bg-[#0c0c0e] text-neutral-100 select-none overflow-hidden font-sans relative">
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
                kernelMatrix={`0 -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} ${(
                  1 +
                  4 * sharpenK
                ).toFixed(3)} -${sharpenK.toFixed(3)} 0 -${sharpenK.toFixed(3)} 0`}
                preserveAlpha="true"
              />
            ) : null}
          </filter>
        </defs>
      </svg>

      {/* ── TOP HEADER / TOOLBAR ── */}
      <header className="h-12 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-3 z-30 shrink-0">
        {/* Left: Gallery Breadcrumb & Exit */}
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/galleries/${gallery.id}`}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Exit Studio</span>
          </Link>
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide font-oswald uppercase truncate max-w-[140px] sm:max-w-[200px]">
              {gallery.name}
            </span>
          </div>
        </div>

        {/* Center: View Controls & Quick Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* View Mode */}
          <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer text-xs",
                viewMode === "split"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              onClick={() => setViewMode("edited")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer text-xs",
                viewMode === "edited"
                  ? "bg-neutral-800 text-white shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Edited</span>
            </button>
          </div>

          {/* Quick Rotation */}
          <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
            <button
              onClick={handleRotateCCW}
              className="p-1 rounded-md text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Rotate 90° CCW"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRotateCW}
              className="p-1 rounded-md text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
              title="Rotate 90° CW"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFlipH}
              className="p-1 rounded-md text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Flip Horizontal"
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="hidden lg:flex items-center text-[10px] text-neutral-400 bg-neutral-950 px-2 py-1 rounded-md border border-neutral-800">
            <span className="text-neutral-500 mr-1">Hold</span>
            <kbd className="bg-neutral-800 px-1 rounded font-mono text-neutral-300">Space</kbd>
            <span className="text-neutral-500 ml-1">Original</span>
          </div>
        </div>

        {/* Right: Save & Export Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            disabled={isSavingDraft}
            onClick={handleSaveDraft}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-all cursor-pointer disabled:opacity-50"
            title="Save draft recipe to database"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save Draft</span>
          </button>

          <button
            disabled={isSavingFinal}
            onClick={handleSaveFinalDelivery}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Render high-res master and publish to Final Delivery set"
          >
            {isSavingFinal ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            <span>Deliver Final</span>
          </button>

          <button
            onClick={handleExportDownload}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
            title="Download full resolution JPEG"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xl:inline">Export</span>
          </button>

          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-amber-400 flex items-center gap-1.5 border border-amber-500/20 transition-colors cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Batch ({activePhotos.length})</span>
          </button>
        </div>
      </header>

      {/* ── MAIN STUDIO WORKSPACE ── */}
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        {/* ── LEFT FILMSTRIP DOCK (COLLAPSIBLE) ── */}
        <aside
          className={cn(
            "h-full bg-[#111114] border-r border-neutral-800/90 flex flex-col transition-all duration-300 z-20 shrink-0",
            isLeftFilmstripOpen ? "w-48 sm:w-56" : "w-10"
          )}
        >
          {/* Filmstrip Header */}
          <div className="h-10 border-b border-neutral-800 px-2.5 flex items-center justify-between shrink-0">
            {isLeftFilmstripOpen ? (
              <>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald truncate">
                  <span>Gallery Filmstrip</span>
                  <span className="text-[10px] font-mono text-amber-400 font-normal">
                    ({selectedPhotoIdx + 1}/{activePhotos.length})
                  </span>
                </div>
                <button
                  onClick={() => setIsLeftFilmstripOpen(false)}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsLeftFilmstripOpen(true)}
                className="w-full flex justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Expand Filmstrip"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </div>

          {isLeftFilmstripOpen && (
            <>
              {/* Filter Tabs */}
              <div className="p-2 border-b border-neutral-800/80 grid grid-cols-2 gap-1 text-[11px] font-medium shrink-0">
                <button
                  onClick={() => {
                    setFilterMode("all")
                    setSelectedPhotoIdx(0)
                  }}
                  className={cn(
                    "py-1 rounded text-center transition-all cursor-pointer",
                    filterMode === "all"
                      ? "bg-neutral-800 text-white font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  All ({photosList.length})
                </button>
                <button
                  onClick={() => {
                    setFilterMode("starred")
                    setSelectedPhotoIdx(0)
                  }}
                  className={cn(
                    "py-1 rounded text-center transition-all flex items-center justify-center gap-1 cursor-pointer",
                    filterMode === "starred"
                      ? "bg-amber-400/20 text-amber-400 border border-amber-400/40 font-bold"
                      : "text-neutral-400 hover:text-amber-400"
                  )}
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>Starred</span>
                </button>
              </div>

              {/* Photo Thumbnails Scroll List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
                {activePhotos.map((photo, idx) => {
                  const isSelected = idx === selectedPhotoIdx
                  return (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={cn(
                        "w-full rounded-lg overflow-hidden border p-1.5 text-left transition-all relative flex gap-2 items-center group cursor-pointer",
                        isSelected
                          ? "bg-amber-500/15 border-amber-400/80 shadow-md ring-1 ring-amber-400/50"
                          : "bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60"
                      )}
                    >
                      <div className="w-12 h-12 rounded bg-black overflow-hidden shrink-0 relative flex items-center justify-center border border-neutral-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.src}
                          alt={photo.title}
                          className="w-full h-full object-cover"
                        />
                        {photo.isStarred && (
                          <div className="absolute top-0.5 right-0.5 bg-amber-400 text-black p-0.5 rounded-full shadow-xs">
                            <Star className="h-2 w-2 fill-black" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <p className="text-xs font-semibold text-neutral-200 truncate group-hover:text-white">
                          {photo.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {photo.isRaw && (
                            <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded">
                              RAW
                            </span>
                          )}
                          {photo.comments.length > 0 && (
                            <span className="text-[9px] text-neutral-400 flex items-center gap-0.5">
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>{photo.comments.length}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </aside>

        {/* ── CENTER CANVAS VIEWPORT ── */}
        <main className="flex-1 min-w-0 h-full relative overflow-hidden flex items-center justify-center p-3 sm:p-6 bg-[#0a0a0c]">
          {/* Photo Frame Container */}
          <div
            ref={photoFrameRef}
            onClick={activeTab === "focus" ? handleCanvasClickToSetFocus : undefined}
            className={cn(
              "relative rounded-xl overflow-hidden shadow-2xl transition-all duration-200 border border-neutral-800/90 bg-black flex items-center justify-center max-w-full max-h-full",
              activeTab === "focus" ? "cursor-crosshair" : "cursor-default"
            )}
            style={{
              transform:
                activeRecipe.straighten !== 0
                  ? `rotate(${activeRecipe.straighten}deg)`
                  : undefined,
            }}
          >
            {/* Image Layer Base */}
            <div
              className="relative w-full h-full overflow-hidden flex items-center justify-center max-h-full max-w-full"
              style={
                showCommittedCropView
                  ? {
                      clipPath: `inset(${currentCrop.y}% ${
                        100 - (currentCrop.x + currentCrop.width)
                      }% ${100 - (currentCrop.y + currentCrop.height)}% ${currentCrop.x}%)`,
                    }
                  : undefined
              }
            >
              {/* Layer 1: Original Image Base */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhoto.src}
                alt={currentPhoto.title}
                className="pointer-events-none block max-w-full max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
              />

              {/* Layer 2: Live Edited Image */}
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
                    className="block max-w-full max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
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
                    className="block max-w-full max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
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
                </div>
              )}
            </div>

            {/* Split Screen Slider Divider & Handle */}
            {viewMode === "split" && (
              <div
                className="absolute inset-y-0 z-20 pointer-events-none"
                style={{ left: `${splitPos}%` }}
              >
                <div className="w-0.5 h-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)] pointer-events-none" />
                <div
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingSplit(true)
                  }}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-amber-400 text-black flex items-center justify-center shadow-2xl cursor-ew-resize pointer-events-auto hover:scale-110 active:scale-95 transition-transform"
                >
                  <SplitSquareVertical className="h-4 w-4" />
                </div>
              </div>
            )}

            {/* Draggable Focal Reticle */}
            {activeTab === "focus" && activeRecipe.focusEnabled && (
              <div
                onMouseDown={handleFocalReticleMouseDown}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group select-none"
                style={{
                  left: `${activeRecipe.focalPoint.x}%`,
                  top: `${activeRecipe.focalPoint.y}%`,
                }}
              >
                <div className="relative w-12 h-12 rounded-full border-2 border-amber-400 flex items-center justify-center shadow-2xl bg-amber-400/20 group-hover:scale-110 transition-transform">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                  <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/60 animate-spin-slow" />
                </div>
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap bg-black/90 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 border border-amber-400/40 pointer-events-none shadow-lg">
                  f/{activeRecipe.aperture} • Drag to position
                </span>
              </div>
            )}

            {/* Interactive Crop Overlay */}
            {activeTab === "crop" && (
              <div className="absolute inset-0 z-30 pointer-events-auto">
                <div
                  className="absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
                  style={{
                    left: `${currentCrop.x}%`,
                    top: `${currentCrop.y}%`,
                    width: `${currentCrop.width}%`,
                    height: `${currentCrop.height}%`,
                  }}
                >
                  {/* Rule of Thirds Lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-amber-400/30" />
                    <div className="border-r border-b border-amber-400/30" />
                    <div className="border-b border-amber-400/30" />
                    <div className="border-r border-b border-amber-400/30" />
                    <div className="border-r border-b border-amber-400/30" />
                    <div className="border-b border-amber-400/30" />
                    <div className="border-r border-amber-400/30" />
                    <div className="border-r border-amber-400/30" />
                    <div />
                  </div>

                  {/* Center Drag Zone */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsDraggingCropHandle("move")
                      setCropDragStart({
                        startX: e.clientX,
                        startY: e.clientY,
                        startBox: { ...currentCrop },
                      })
                    }}
                    className="absolute inset-0 cursor-move flex items-center justify-center"
                  >
                    <div className="bg-black/80 px-2.5 py-1 rounded-full border border-amber-400/40 text-[10px] font-mono text-amber-400 shadow-lg flex items-center gap-1">
                      <Move className="h-3 w-3" />
                      <span>Drag to Pan Crop</span>
                    </div>
                  </div>

                  {/* Corner Handles */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingCropHandle("nw")
                      setCropDragStart({
                        startX: e.clientX,
                        startY: e.clientY,
                        startBox: { ...currentCrop },
                      })
                    }}
                    className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-amber-400 border border-black cursor-nwse-resize rounded-xs"
                  />
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingCropHandle("ne")
                      setCropDragStart({
                        startX: e.clientX,
                        startY: e.clientY,
                        startBox: { ...currentCrop },
                      })
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 border border-black cursor-nesw-resize rounded-xs"
                  />
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingCropHandle("sw")
                      setCropDragStart({
                        startX: e.clientX,
                        startY: e.clientY,
                        startBox: { ...currentCrop },
                      })
                    }}
                    className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-amber-400 border border-black cursor-nesw-resize rounded-xs"
                  />
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsDraggingCropHandle("se")
                      setCropDragStart({
                        startX: e.clientX,
                        startY: e.clientY,
                        startBox: { ...currentCrop },
                      })
                    }}
                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-amber-400 border border-black cursor-nwse-resize rounded-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── RIGHT INSPECTOR PANEL (COLLAPSIBLE) ── */}
        <aside
          className={cn(
            "h-full bg-[#111114] border-l border-neutral-800/90 flex flex-col transition-all duration-300 z-20 shrink-0",
            isRightInspectorOpen ? "w-80 sm:w-92" : "w-10"
          )}
        >
          {/* Header */}
          <div className="h-10 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0">
            {isRightInspectorOpen ? (
              <>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-oswald">
                  Studio Controls
                </span>
                <button
                  onClick={() => setIsRightInspectorOpen(false)}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsRightInspectorOpen(true)}
                className="w-full flex justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Expand Inspector"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            )}
          </div>

          {isRightInspectorOpen && (
            <>
              {/* Tab Navigation */}
              <div className="grid grid-cols-6 border-b border-neutral-800/80 p-1 bg-black/40 text-[10px] shrink-0">
                <button
                  onClick={() => setActiveTab("ai")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "ai"
                      ? "bg-amber-500/20 text-amber-400 font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI</span>
                </button>
                <button
                  onClick={() => setActiveTab("light")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "light"
                      ? "bg-amber-500/20 text-amber-400 font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => setActiveTab("color")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "color"
                      ? "bg-amber-500/20 text-amber-400 font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Palette className="h-3.5 w-3.5" />
                  <span>Color</span>
                </button>
                <button
                  onClick={() => setActiveTab("focus")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "focus"
                      ? "bg-amber-500/20 text-amber-400 font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Aperture className="h-3.5 w-3.5" />
                  <span>Focus</span>
                </button>
                <button
                  onClick={() => setActiveTab("crop")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "crop"
                      ? "bg-amber-400 text-black font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Crop className="h-3.5 w-3.5" />
                  <span>Crop</span>
                </button>
                <button
                  onClick={() => setActiveTab("effects")}
                  className={cn(
                    "py-1.5 flex flex-col items-center gap-0.5 rounded font-semibold transition-all cursor-pointer",
                    activeTab === "effects"
                      ? "bg-amber-500/20 text-amber-400 font-bold"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Detail</span>
                </button>
              </div>

              {/* Inspector Content Scroll Container */}
              <div className="flex-1 overflow-y-auto p-4 pb-12 space-y-6 scrollbar-thin scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-700">
                {/* ── TAB 1: AI DIRECTOR ── */}
                {activeTab === "ai" && (
                  <div className="space-y-4 animate-in fade-in-50">
                    {/* Client Notes / Comments Card */}
                    {currentPhoto.comments.length > 0 && (
                      <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" /> Client Notes
                        </span>
                        {currentPhoto.comments.map((cmt, i) => (
                          <p key={i} className="text-xs text-neutral-300 italic">
                            “{cmt}”
                          </p>
                        ))}
                      </div>
                    )}

                    {/* AI Scene Analysis Card */}
                    <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-oswald">
                            Content-Aware AI
                          </h4>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/10">
                          Smart Salience ⚡
                        </Badge>
                      </div>

                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Detected scene composition with balanced lighting. Recommended edits apply authentic neutral tones with subtle f/2.0 optical separation.
                      </p>
                    </div>

                    {/* Creative Looks */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase text-neutral-400 tracking-wider">
                        Creative Proposals
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          {
                            name: "True-to-Life Clean (Neutral)",
                            tag: "Natural skin tones, 0% cast & subtle depth",
                            icon: "✨",
                            recipe: {
                              exposure: 0.1,
                              contrast: 8,
                              highlights: -16,
                              shadows: 20,
                              temp: 0,
                              tint: 0,
                              vibrance: 12,
                              saturation: 2,
                              focusEnabled: true,
                              aperture: 2.0,
                              sharpening: 20,
                            },
                          },
                          {
                            name: "Warm Golden Sunset",
                            tag: "Warm amber glow, lifted shadows & soft grain",
                            icon: "🌅",
                            recipe: {
                              exposure: 0.2,
                              contrast: 8,
                              highlights: -18,
                              shadows: 24,
                              temp: 14,
                              tint: 4,
                              vibrance: 14,
                              saturation: 4,
                              focusEnabled: true,
                              aperture: 2.0,
                              grain: 12,
                              sharpening: 25,
                            },
                          },
                          {
                            name: "Cool Nordic Editorial",
                            tag: "Clean cool shadows & modern high-end clarity",
                            icon: "❄️",
                            recipe: {
                              exposure: 0.15,
                              contrast: 14,
                              highlights: -20,
                              shadows: 18,
                              temp: -8,
                              tint: 2,
                              vibrance: 10,
                              saturation: -4,
                              focusEnabled: true,
                              aperture: 2.8,
                              clarity: 15,
                              sharpening: 30,
                            },
                          },
                        ].map((look) => (
                          <button
                            key={look.name}
                            onClick={() => {
                              updateRecipe({ ...look.recipe })
                              toast.success(`Applied "${look.name}" look ✨`)
                            }}
                            className="w-full text-left p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/80 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-2">
                              <span>{look.icon}</span>
                              <span className="text-xs font-bold text-white group-hover:text-amber-400">
                                {look.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-1">{look.tag}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: LIGHT & TONE CURVE ── */}
                {activeTab === "light" && (
                  <div className="space-y-5 animate-in fade-in-50">
                    <ToneCurveEditor
                      points={activeRecipe.curvePoints || DEFAULT_CURVE_POINTS}
                      onChange={(newPts) => updateRecipe({ curvePoints: newPts })}
                      channel={activeRecipe.curveChannel || "rgb"}
                      onChannelChange={(ch) => updateRecipe({ curveChannel: ch })}
                    />

                    {/* Sliders */}
                    <div className="space-y-4">
                      {/* Exposure */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-neutral-400">Exposure</span>
                          <span className="font-mono text-amber-400">
                            {activeRecipe.exposure > 0
                              ? `+${activeRecipe.exposure.toFixed(2)} EV`
                              : `${activeRecipe.exposure.toFixed(2)} EV`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.05"
                          value={activeRecipe.exposure}
                          onChange={(e) =>
                            updateRecipe({ exposure: parseFloat(e.target.value) })
                          }
                          className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-neutral-400">Contrast</span>
                          <span className="font-mono text-amber-400">
                            {activeRecipe.contrast > 0
                              ? `+${activeRecipe.contrast}`
                              : activeRecipe.contrast}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={activeRecipe.contrast}
                          onChange={(e) =>
                            updateRecipe({ contrast: parseInt(e.target.value) })
                          }
                          className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Highlights */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-neutral-400">Highlights</span>
                          <span className="font-mono text-amber-400">
                            {activeRecipe.highlights > 0
                              ? `+${activeRecipe.highlights}`
                              : activeRecipe.highlights}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={activeRecipe.highlights}
                          onChange={(e) =>
                            updateRecipe({ highlights: parseInt(e.target.value) })
                          }
                          className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Shadows */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-neutral-400">Shadows</span>
                          <span className="font-mono text-amber-400">
                            {activeRecipe.shadows > 0
                              ? `+${activeRecipe.shadows}`
                              : activeRecipe.shadows}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={activeRecipe.shadows}
                          onChange={(e) =>
                            updateRecipe({ shadows: parseInt(e.target.value) })
                          }
                          className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 3: COLOR & WHITE BALANCE ── */}
                {activeTab === "color" && (
                  <div className="space-y-4 animate-in fade-in-50">
                    {/* Temperature */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Color Temperature</span>
                        <span className="font-mono text-amber-400">
                          {activeRecipe.temp > 0 ? `+${activeRecipe.temp}K` : `${activeRecipe.temp}K`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={activeRecipe.temp}
                        onChange={(e) => updateRecipe({ temp: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-gradient-to-r from-blue-500 via-neutral-600 to-amber-500 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Tint */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Tint</span>
                        <span className="font-mono text-amber-400">{activeRecipe.tint}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={activeRecipe.tint}
                        onChange={(e) => updateRecipe({ tint: parseInt(e.target.value) })}
                        className="w-full accent-purple-400 h-1.5 bg-gradient-to-r from-emerald-500 via-neutral-600 to-magenta-500 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Vibrance */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Vibrance</span>
                        <span className="font-mono text-amber-400">+{activeRecipe.vibrance}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={activeRecipe.vibrance}
                        onChange={(e) => updateRecipe({ vibrance: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Saturation</span>
                        <span className="font-mono text-amber-400">{activeRecipe.saturation}</span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        step="1"
                        value={activeRecipe.saturation}
                        onChange={(e) => updateRecipe({ saturation: parseInt(e.target.value) })}
                        className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* ── TAB 4: FOCUS & OPTICAL DEPTH ── */}
                {activeTab === "focus" && (
                  <div className="space-y-4 animate-in fade-in-50">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Aperture className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">Enable Optical Bokeh</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeRecipe.focusEnabled}
                        onChange={(e) => updateRecipe({ focusEnabled: e.target.checked })}
                        className="h-4 w-4 accent-amber-400 rounded cursor-pointer"
                      />
                    </div>

                    {activeRecipe.focusEnabled && (
                      <>
                        {/* Aperture F-Stop */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-neutral-400 block">
                            Lens Aperture
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {[1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 16.0].map((f) => (
                              <button
                                key={f}
                                onClick={() => updateRecipe({ aperture: f })}
                                className={cn(
                                  "py-1.5 rounded text-[11px] font-mono font-bold border transition-all cursor-pointer",
                                  activeRecipe.aperture === f
                                    ? "bg-amber-400 text-black border-amber-400 shadow-md"
                                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                                )}
                              >
                                f/{f}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Blur Amount */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-neutral-400">Background Blur Falloff</span>
                            <span className="font-mono text-amber-400">
                              {activeRecipe.blurRadius} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={activeRecipe.blurRadius}
                            onChange={(e) =>
                              updateRecipe({ blurRadius: parseFloat(e.target.value) })
                            }
                            className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── TAB 5: CROP & FRAMING ── */}
                {activeTab === "crop" && (
                  <div className="space-y-4 animate-in fade-in-50">
                    <button
                      onClick={handleApplyCrop}
                      className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Apply & Commit Crop</span>
                    </button>

                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-neutral-400 block">
                        Aspect Ratio Presets
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: "Freeform", value: "custom" },
                          { label: "Original", value: "original" },
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
                              "py-1.5 rounded text-[11px] font-semibold border transition-all text-center cursor-pointer",
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

                    {/* Orientation */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                      <span className="text-xs font-medium text-neutral-400 block">
                        Rotate & Orientation
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          onClick={handleRotateCCW}
                          className="py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="h-4 w-4 text-amber-400" />
                          <span className="text-[10px]">-90°</span>
                        </button>
                        <button
                          onClick={handleRotateCW}
                          className="py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        >
                          <RotateCw className="h-4 w-4 text-amber-400" />
                          <span className="text-[10px]">+90°</span>
                        </button>
                        <button
                          onClick={handleFlipH}
                          className="py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        >
                          <FlipHorizontal className="h-4 w-4" />
                          <span className="text-[10px]">Flip H</span>
                        </button>
                        <button
                          onClick={handleFlipV}
                          className="py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 flex flex-col items-center justify-center gap-1 cursor-pointer"
                        >
                          <FlipVertical className="h-4 w-4" />
                          <span className="text-[10px]">Flip V</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 6: SHARPENING & DETAIL ── */}
                {activeTab === "effects" && (
                  <div className="space-y-4 animate-in fade-in-50">
                    {/* Edge Sharpening */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400 flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                          <span>Edge Sharpening</span>
                        </span>
                        <span className="font-mono text-amber-400">
                          +{activeRecipe.sharpening || 0}%
                        </span>
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
                    </div>

                    {/* Sharpen Radius */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Sharpening Radius</span>
                        <span className="font-mono text-amber-400">
                          {activeRecipe.sharpenRadius || 1.0} px
                        </span>
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

                    {/* Clarity */}
                    <div className="space-y-1.5">
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

                    {/* Analog Film Grain */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-neutral-400">Analog Film Grain</span>
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
                    <div className="space-y-1.5">
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
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── BATCH SYNC & PUBLISH MODAL ── */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white font-oswald uppercase">
                    Batch Sync & Publish
                  </h3>
                </div>
                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-neutral-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Apply your current color grade, tone curve, crop, and sharpening settings across{" "}
                <strong className="text-amber-400 font-bold">{activePhotos.length} active photos</strong>.
              </p>

              <div className="space-y-3">
                <button
                  disabled={isBatchProcessing}
                  onClick={() => handleBatchPublish(false)}
                  className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center justify-center gap-2 border border-neutral-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>Sync Draft Recipes Only</span>
                </button>

                <button
                  disabled={isBatchProcessing}
                  onClick={() => handleBatchPublish(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {isBatchProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  <span>Render & Publish All to Final Delivery</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
