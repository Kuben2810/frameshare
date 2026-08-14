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
} from "lucide-react"
import { deletePhoto } from "@/app/actions/galleries"
import { toast } from "sonner"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos } from "@/db/schema"
import { ACCEPTED_TYPES, MAX_SIZE_BYTES } from "@/lib/photo-constraints"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>

const ACCEPTED = Object.fromEntries(ACCEPTED_TYPES.map((t) => [t, []]))

export function GalleryEditor({ gallery, photos: initialPhotos }: { gallery: Gallery; photos: Photo[] }) {
  const [photoList, setPhotoList] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return

      for (const file of accepted) {
        setUploading((u) => [...u, { name: file.name, progress: 0 }])

        try {
          // 1. Get presigned upload URL
          const res = await fetch("/api/upload/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              galleryId: gallery.id,
              filename: file.name,
              fileSize: file.size,
              mimeType: file.type,
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
          toast.success(`Uploaded & processed ${file.name}`)
        } catch {
          toast.error(`Upload failed: ${file.name}`)
        } finally {
          setUploading((u) => u.filter((f) => f.name !== file.name))
        }
      }
    },
    [gallery.id]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
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

  function toggleSelect(photoId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedIds((s) => {
      const n = new Set(s)
      n.has(photoId) ? n.delete(photoId) : n.add(photoId)
      return n
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === photoList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(photoList.map((p) => p.id)))
    }
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
      {/* ── Drag & Drop Luxury Upload Zone ── */}
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed p-8 md:p-12 text-center cursor-pointer transition-all duration-300 group",
          isDragActive
            ? "border-primary bg-primary/10 scale-[1.005] shadow-lg ring-4 ring-primary/20"
            : "border-border/80 hover:border-primary/50 bg-card/60 hover:bg-card shadow-xs"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300",
              isDragActive
                ? "bg-primary text-primary-foreground scale-110 shadow-md"
                : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
            )}
          >
            <Upload className="h-6 w-6 stroke-[1.75]" />
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              {isDragActive ? "Drop high-res photos here" : "Drag & drop photos here, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports JPEG, PNG, WebP, and TIFF • Max 50 MB per photo • Batch uploads supported
            </p>
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

      {/* ── Photos Grid Toolbar & Batch Selection ── */}
      {photoList.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border/70 rounded-xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedIds.size === photoList.length ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>
                  {selectedIds.size === 0
                    ? "Select All"
                    : `Selected (${selectedIds.size} of ${photoList.length})`}
                </span>
              </button>

              {selectedIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeletingBatch}
                  className={cn(
                    buttonVariants({ variant: "destructive", size: "sm" }),
                    "h-8 gap-1.5 rounded-lg text-xs"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedIds.size})</span>
                </button>
              )}
            </div>

            <span className="text-xs font-medium text-muted-foreground">
              {photoList.length} photo{photoList.length !== 1 ? "s" : ""} in gallery
            </span>
          </div>

          {/* ── Photo Cards Grid ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {photoList.map((photo, idx) => {
              const isSelected = selectedIds.has(photo.id)

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

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* Multi-select checkbox */}
                  <button
                    onClick={(e) => toggleSelect(photo.id, e)}
                    className={cn(
                      "absolute top-2 left-2 p-1 rounded-md transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground opacity-100"
                        : "bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80"
                    )}
                    title="Select photo"
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(photo.id, e)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-destructive text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Bottom Filename / Dimension info */}
                  <div className="absolute bottom-1.5 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-white pointer-events-none">
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
                  onClick={() => handleDelete(previewPhoto.id)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-destructive text-white transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="relative max-h-[78vh] w-full flex items-center justify-center rounded-2xl overflow-hidden bg-black/40 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/s3/${previewPhoto.displayKey ?? previewPhoto.originalKey}`}
                alt={previewPhoto.filename}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
