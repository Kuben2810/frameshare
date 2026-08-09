"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Trash2, Upload, Loader2 } from "lucide-react"
import { deletePhoto } from "@/app/actions/galleries"
import { toast } from "sonner"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos } from "@/db/schema"
import { ACCEPTED_TYPES, MAX_SIZE_BYTES } from "@/lib/photo-constraints"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>

const ACCEPTED = Object.fromEntries(ACCEPTED_TYPES.map((t) => [t, []]))

export function GalleryEditor({ gallery, photos: initialPhotos }: { gallery: Gallery; photos: Photo[] }) {
  const [photoList, setPhotoList] = useState(initialPhotos)
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([])

  const onDrop = useCallback(async (accepted: File[]) => {
    for (const file of accepted) {
      setUploading((u) => [...u, { name: file.name, progress: 0 }])

      try {
        const res = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ galleryId: gallery.id, filename: file.name, fileSize: file.size, mimeType: file.type }),
        })
        if (!res.ok) { toast.error(`Failed to start upload: ${file.name}`); continue }
        const { url, photoId } = await res.json()

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
    maxSize: MAX_SIZE_BYTES,
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
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 bg-muted/30"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-7 w-7 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop photos here" : "Drag photos here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">JPEG, PNG, TIFF, WebP — max 50 MB each</p>
      </div>

      {uploading.length > 0 && (
        <div className="space-y-3 py-1">
          {uploading.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0 text-primary" />
                  <span className="truncate text-foreground">{f.name}</span>
                </div>
                <span className="text-muted-foreground tabular-nums ml-2 shrink-0">{Math.round(f.progress)}%</span>
              </div>
              <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {photoList.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {photoList.map((photo) => (
            <div key={photo.id} className="group relative aspect-square bg-muted rounded overflow-hidden">
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
