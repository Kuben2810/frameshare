"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  X,
  Maximize2,
  CheckSquare,
  Square,
  Images,
  Sparkles,
  Info,
  Check,
  RotateCw,
} from "lucide-react"
import { deletePhoto, rotatePhoto } from "@/app/actions/galleries"
import { toast } from "sonner"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos } from "@/db/schema"
import { ACCEPTED_TYPES, MAX_SIZE_BYTES } from "@/lib/photo-constraints"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>

const DROPZONE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/tiff": [".tif", ".tiff"],
  "image/x-canon-cr2": [".cr2"],
  "image/x-canon-cr3": [".cr3"],
  "image/x-nikon-nef": [".nef"],
  "image/x-sony-arw": [".arw"],
  "image/x-adobe-dng": [".dng"],
  "image/x-fuji-raf": [".raf"],
  "image/x-panasonic-raw": [".rw2"],
  "image/x-olympus-orf": [".orf"],
  "application/octet-stream": [".cr2", ".cr3", ".nef", ".arw", ".dng", ".raf", ".orf", ".rw2", ".raw"],
}

export function GalleryEditor({ gallery, photos: initialPhotos }: { gallery: Gallery; photos: Photo[] }) {
  const [photoList, setPhotoList] = useState<Photo[]>(initialPhotos)
  const [activeSection, setActiveSection] = useState<"all" | "proofing" | "final">("proofing")
  const [uploadTargetSection, setUploadTargetSection] = useState<"proofing" | "final">("proofing")
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rotatingIds, setRotatingIds] = useState<Set<string>>(new Set())
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const [isMovingBatch, setIsMovingBatch] = useState(false)
  const [isRotatingBatch, setIsRotatingBatch] = useState(false)

  const proofingCount = photoList.filter((p) => (p.section ?? "proofing") === "proofing").length
  const finalCount = photoList.filter((p) => p.section === "final").length

  const filteredPhotos = photoList.filter((p) => {
    if (activeSection === "all") return true
    return (p.section ?? "proofing") === activeSection
  })

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return

      for (const file of accepted) {
        setUploading((u) => [...u, { name: file.name, progress: 0 }])

        try {
          // 1. Get presigned upload URL with target section
          const res = await fetch("/api/upload/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              galleryId: gallery.id,
              filename: file.name,
              fileSize: file.size,
              mimeType: file.type,
              section: uploadTargetSection,
            }),
          })

          if (!res.ok) {
            toast.error(`Upload error: ${file.name}`)
            continue
          }
          const { url, photoId } = await res.json()

          // 2. Direct S3 PUT
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setUploading((u) =>
                  u.map((f) => (f.name === file.name ? { ...f, progress: (e.loaded / e.total) * 100 } : f))
                )
              }
            }
            xhr.onload = () => (xhr.status < 300 ? resolve() : reject(xhr.status))
            xhr.onerror = reject
            xhr.open("PUT", url)
            xhr.setRequestHeader("Content-Type", file.type)
            xhr.send(file)
          })

          // 3. Process variants (Sharp thumbnails, display, watermarks)
          const processRes = await fetch("/api/upload/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId }),
          })

          if (!processRes.ok) {
            toast.error(`Processing error: ${file.name}`)
            continue
          }

          const { photo } = await processRes.json()
          setPhotoList((p) => [...p, photo])
          toast.success(`Uploaded to ${uploadTargetSection === "final" ? "Final Delivery" : "Proofing"}: ${file.name}`)
        } catch {
          toast.error(`Upload failed: ${file.name}`)
        } finally {
          setUploading((u) => u.filter((f) => f.name !== file.name))
        }
      }
    },
    [gallery.id, uploadTargetSection]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    maxSize: MAX_SIZE_BYTES,
    multiple: true,
  })

  async function handleDelete(photoId: string, e?: React.MouseEvent) {
    if (e) {
      e.stopPropagation()
    }
    await deletePhoto(photoId)
    setPhotoList((p) => p.filter((ph) => ph.id !== photoId))
    setSelectedIds((s) => {
      const n = new Set(s)
      n.delete(photoId)
      return n
    })
    toast.success("Photo deleted")
  }

  async function handleRotate(photoId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setRotatingIds((s) => new Set(s).add(photoId))
    try {
      await rotatePhoto(photoId, 90)
      const cacheBust = `?t=${Date.now()}`
      setPhotoList((list) =>
        list.map((p) => {
          if (p.id === photoId) {
            return {
              ...p,
              width: p.height ?? p.width,
              height: p.width ?? p.height,
              thumbKey: p.thumbKey ? `${p.thumbKey.split("?")[0]}${cacheBust}` : p.thumbKey,
              displayKey: p.displayKey ? `${p.displayKey.split("?")[0]}${cacheBust}` : p.displayKey,
            }
          }
          return p
        })
      )
      toast.success("Photo rotated 90°")
    } catch {
      toast.error("Failed to rotate photo")
    } finally {
      setRotatingIds((s) => {
        const next = new Set(s)
        next.delete(photoId)
        return next
      })
    }
  }

  async function handleRotateSelected() {
    if (selectedIds.size === 0) return
    setIsRotatingBatch(true)
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await rotatePhoto(id, 90)
      }
      const cacheBust = `?t=${Date.now()}`
      setPhotoList((list) =>
        list.map((p) => {
          if (selectedIds.has(p.id)) {
            return {
              ...p,
              width: p.height ?? p.width,
              height: p.width ?? p.height,
              thumbKey: p.thumbKey ? `${p.thumbKey.split("?")[0]}${cacheBust}` : p.thumbKey,
              displayKey: p.displayKey ? `${p.displayKey.split("?")[0]}${cacheBust}` : p.displayKey,
            }
          }
          return p
        })
      )
      toast.success(`Rotated ${ids.length} photo(s) 90°`)
    } catch {
      toast.error("Failed to rotate selected photos")
    } finally {
      setIsRotatingBatch(false)
    }
  }

  function toggleSelect(photoId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds((s) => {
      const n = new Set(s)
      n.has(photoId) ? n.delete(photoId) : n.add(photoId)
      return n
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredPhotos.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPhotos.map((p) => p.id)))
    }
  }

  async function handleMoveSelected(targetSection: "proofing" | "final") {
    if (selectedIds.size === 0) return
    setIsMovingBatch(true)
    const { movePhotosToSection } = await import("@/app/actions/galleries")
    const ids = Array.from(selectedIds)
    await movePhotosToSection(gallery.id, ids, targetSection)
    setPhotoList((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, section: targetSection } : p))
    )
    setSelectedIds(new Set())
    setIsMovingBatch(false)
    toast.success(`Moved ${ids.length} photo(s) to ${targetSection === "final" ? "Final Delivery" : "Proofing"}`)
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected photo(s)? This cannot be undone.`)) {
      return
    }

    setIsDeletingBatch(true)
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await deletePhoto(id)
    }
    setPhotoList((p) => p.filter((ph) => !selectedIds.has(ph.id)))
    setSelectedIds(new Set())
    setIsDeletingBatch(false)
    toast.success(`Deleted ${ids.length} photo(s)`)
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* ── Drag & Drop Luxury Upload Zone with Target Section Selector ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Upload Destination:
            </span>
            <div className="inline-flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/70 text-xs">
              <button
                type="button"
                onClick={() => setUploadTargetSection("proofing")}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-all",
                  uploadTargetSection === "proofing"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🌟 Proofing Set
              </button>
              <button
                type="button"
                onClick={() => setUploadTargetSection("final")}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-all",
                  uploadTargetSection === "final"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                ✨ Final Delivery Set
              </button>
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground font-mono">
            Uploading as <strong className="text-foreground">{uploadTargetSection === "final" ? "Master Retouched" : "Proofing Preview"}</strong>
          </span>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 border-dashed p-8 md:p-10 text-center cursor-pointer transition-all duration-300 group",
            isDragActive
              ? "border-primary bg-primary/10 scale-[1.005] shadow-lg ring-4 ring-primary/20"
              : "border-border/80 hover:border-primary/50 bg-card/60 hover:bg-card shadow-xs"
          )}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                isDragActive
                  ? "bg-primary text-primary-foreground scale-110 shadow-md"
                  : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
              )}
            >
              <Upload className="h-5 w-5 stroke-[1.75]" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isDragActive
                  ? `Drop photos to upload into ${uploadTargetSection === "final" ? "Final Delivery" : "Proofing"}`
                  : `Drag & drop photos into ${uploadTargetSection === "final" ? "Final Delivery" : "Proofing Set"}`}
              </p>
              <p className="text-xs text-muted-foreground">
                RAW (CR2, CR3, NEF, ARW, DNG, RAF), JPEG, PNG, WebP • Max 100 MB per photo • Auto-converted for web proofing
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Uploads Progress Bar Queue ── */}
      {uploading.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/80 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground pb-1">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Uploading & Processing {uploading.length} photo(s)…</span>
            </span>
          </div>

          <div className="space-y-2.5">
            {uploading.map((f) => (
              <div key={f.name} className="space-y-1 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate max-w-xs font-medium text-foreground">{f.name}</span>
                  <span className="text-muted-foreground font-mono tabular-nums">{Math.round(f.progress)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-150"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section Filter Tabs & Batch Selection Toolbar ── */}
      {photoList.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border/70 rounded-xl shadow-xs">
            {/* Set View Tabs */}
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => { setActiveSection("proofing"); setSelectedIds(new Set()) }}
                className={cn(
                  "px-3 py-1.5 rounded-md font-semibold transition-all",
                  activeSection === "proofing"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🌟 Proofing ({proofingCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection("final"); setSelectedIds(new Set()) }}
                className={cn(
                  "px-3 py-1.5 rounded-md font-semibold transition-all",
                  activeSection === "final"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                ✨ Final Delivery ({finalCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveSection("all"); setSelectedIds(new Set()) }}
                className={cn(
                  "px-3 py-1.5 rounded-md font-semibold transition-all",
                  activeSection === "all"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({photoList.length})
              </button>
            </div>

            {/* Batch actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                {selectedIds.size > 0 && selectedIds.size === filteredPhotos.length ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>
                  {selectedIds.size === 0
                    ? "Select All"
                    : `Selected (${selectedIds.size})`}
                </span>
              </button>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleRotateSelected}
                    disabled={isRotatingBatch}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 gap-1.5 rounded-lg text-xs cursor-pointer"
                    )}
                    title="Rotate selected photos 90 degrees"
                  >
                    <RotateCw className={cn("h-3.5 w-3.5", isRotatingBatch && "animate-spin")} />
                    <span>Rotate 90° ↻ ({selectedIds.size})</span>
                  </button>

                  <button
                    onClick={() => handleMoveSelected("final")}
                    disabled={isMovingBatch}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 gap-1 rounded-lg text-xs"
                    )}
                  >
                    <span>Move to Final ✨</span>
                  </button>

                  <button
                    onClick={() => handleMoveSelected("proofing")}
                    disabled={isMovingBatch}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 gap-1 rounded-lg text-xs"
                    )}
                  >
                    <span>Move to Proof 🌟</span>
                  </button>

                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeletingBatch}
                    className={cn(
                      buttonVariants({ variant: "destructive", size: "sm" }),
                      "h-8 gap-1.5 rounded-lg text-xs"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete ({selectedIds.size})</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Photo Cards Grid ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredPhotos.map((photo) => {
              const isSelected = selectedIds.has(photo.id)
              const isFinal = photo.section === "final"

              return (
                <div
                  key={photo.id}
                  onClick={() => setPreviewPhoto(photo)}
                  className={cn(
                    "group relative aspect-square rounded-xl bg-muted/40 overflow-hidden border transition-all duration-200 cursor-pointer shadow-xs",
                    isSelected
                      ? "border-primary ring-2 ring-primary/40 scale-[0.98]"
                      : "border-border/60 hover:border-primary/40 hover:shadow-md"
                  )}
                >
                  {photo.thumbKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/s3/${photo.thumbKey}`}
                      alt={photo.filename}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Images className="h-6 w-6" />
                    </div>
                  )}

                  {/* Top action buttons & section badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
                    <button
                      onClick={(e) => handleRotate(photo.id, e)}
                      disabled={rotatingIds.has(photo.id)}
                      className="p-1 rounded-md bg-black/75 hover:bg-black text-white hover:text-primary backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-xs cursor-pointer"
                      title="Rotate 90° clockwise"
                    >
                      <RotateCw className={cn("h-3.5 w-3.5", rotatingIds.has(photo.id) && "animate-spin")} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(photo.id, e)}
                      className="p-1 rounded-md bg-black/75 hover:bg-destructive text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all shadow-xs cursor-pointer"
                      title="Delete photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md font-mono shadow-xs backdrop-blur-md",
                        isFinal
                          ? "bg-amber-500/90 text-white"
                          : "bg-black/60 text-white/90"
                      )}
                    >
                      {isFinal ? "Final ✨" : "Proof 🌟"}
                    </span>
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Multi-select checkbox */}
                  <button
                    onClick={(e) => toggleSelect(photo.id, e)}
                    className={cn(
                      "absolute top-2 left-2 p-1 rounded-md transition-all z-20",
                      isSelected
                        ? "bg-primary text-primary-foreground opacity-100"
                        : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80"
                    )}
                    title="Select photo"
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>

                  {/* Bottom Filename / Dimension info */}
                  <div className="absolute bottom-1.5 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white pointer-events-none z-10">
                    <p className="text-[11px] font-medium truncate drop-shadow-sm font-mono">{photo.filename}</p>
                    {photo.width && photo.height && (
                      <p className="text-[9px] text-white/70">
                        {photo.width} × {photo.height} • {formatBytes(photo.fileSizeBytes)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── High-Res Preview Lightbox Modal ── */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div className="w-full flex items-center justify-between text-white px-2">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold truncate">{previewPhoto.filename}</h4>
                <p className="text-xs text-white/60">
                  {previewPhoto.width && `${previewPhoto.width} × ${previewPhoto.height} px • `}
                  {formatBytes(previewPhoto.fileSizeBytes)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRotate(previewPhoto.id)}
                  disabled={rotatingIds.has(previewPhoto.id)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Rotate 90° clockwise"
                >
                  <RotateCw className={cn("h-4 w-4", rotatingIds.has(previewPhoto.id) && "animate-spin")} />
                </button>
                <button
                  onClick={() => handleDelete(previewPhoto.id)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-destructive text-white transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Display Image */}
            <div className="relative max-h-[75vh] max-w-full overflow-hidden rounded-xl bg-black border border-white/10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/s3/${previewPhoto.displayKey || previewPhoto.thumbKey}`}
                alt={previewPhoto.filename}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
