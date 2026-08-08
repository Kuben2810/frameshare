"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Trash2, Upload, Loader2, GripVertical } from "lucide-react"
import { deletePhoto, updatePhotoOrder } from "@/app/actions/galleries"
import { toast } from "sonner"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos } from "@/db/schema"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>

const ACCEPTED = { "image/jpeg": [], "image/png": [], "image/tiff": [], "image/webp": [] }
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export function GalleryEditor({ gallery, photos: initialPhotos }: { gallery: Gallery; photos: Photo[] }) {
  const [photoList, setPhotoList] = useState(initialPhotos)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])

  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      setUploading((u) => [...u, { name: file.name, progress: 0 }])

      try {
        // 1. Get presigned URL
        const res = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ galleryId: gallery.id, filename: file.name, fileSize: file.size, mimeType: file.type }),
        })
        if (!res.ok) { toast.error(`Failed to start upload: ${file.name}`); continue }
        const { url, photoId } = await res.json()

        // 2. Upload directly to S3 via XHR for progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setUploading((u) => u.map((f) => f.name === file.name ? { ...f, progress: (e.loaded / e.total) * 100 } : f))
          }
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(xhr.status)
          xhr.onerror = reject
          xhr.open("PUT", url)
          xhr.setRequestHeader("Content-Type", file.type)
          xhr.send(file)
        })

        // 3. Trigger processing (Sharp variants)
        const processRes = await fetch("/api/upload/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId }),
        })
        if (!processRes.ok) { toast.error(`Processing failed: ${file.name}`); continue }
        const { photo } = await processRes.json()
        setPhotoList((p) => [...p, photo])
      } catch {
        toast.error(`Upload failed: ${file.name}`)
      } finally {
        setUploading((u) => u.filter((f) => f.name !== file.name))
      }
    }
  }, [gallery.id])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: true,
  })

  async function handleDelete(photoId: string) {
    await deletePhoto(photoId)
    setPhotoList((p) => p.filter((ph) => ph.id !== photoId))
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-neutral-400" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop photos here" : "Drag photos here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, TIFF, WebP — max 50 MB each</p>
      </div>

      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((f) => (
            <div key={f.name} className="flex items-center gap-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground tabular-nums">{Math.round(f.progress)}%</span>
            </div>
          ))}
        </div>
      )}

      {photoList.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {photoList.map((photo) => (
            <div key={photo.id} className="group relative aspect-square bg-neutral-100 rounded-md overflow-hidden">
              {photo.thumbKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/s3/${encodeURIComponent(photo.thumbKey)}`}
                  alt={photo.filename}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete photo"
              >
                <Trash2 className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
