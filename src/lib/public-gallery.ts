import type { InferSelectModel } from "drizzle-orm"
import type { galleries, photos } from "@/db/schema"

type Gallery = InferSelectModel<typeof galleries>
type Photo = InferSelectModel<typeof photos>

/** Fields safe to serialize to an unauthenticated gallery viewer. */
export type PublicGallery = Pick<
  Gallery,
  "id" | "name" | "slug" | "expiresAt" | "downloadMode" | "stage" |
  "maxSelections" | "logoKey" | "accentColor" | "createdAt"
>

/**
 * A gallery-view photo deliberately excludes private object keys. Display and
 * thumbnail assets are sufficient for viewing; downloads are authorized by
 * the gallery download endpoint using the photo ID.
 */
export type PublicPhoto = Pick<
  Photo,
  "id" | "galleryId" | "section" | "thumbKey" | "displayKey" | "filename" |
  "mimeType" | "fileSizeBytes" | "width" | "height" | "sortOrder" |
  "status" | "blurHash" | "createdAt"
>

export function toPublicGallery(gallery: Gallery): PublicGallery {
  return {
    id: gallery.id,
    name: gallery.name,
    slug: gallery.slug,
    expiresAt: gallery.expiresAt,
    downloadMode: gallery.downloadMode,
    stage: gallery.stage,
    maxSelections: gallery.maxSelections,
    logoKey: gallery.logoKey,
    accentColor: gallery.accentColor,
    createdAt: gallery.createdAt,
  }
}

export function toPublicPhoto(photo: Photo): PublicPhoto {
  return {
    id: photo.id,
    galleryId: photo.galleryId,
    section: photo.section,
    thumbKey: photo.thumbKey,
    displayKey: photo.displayKey,
    filename: photo.filename,
    mimeType: photo.mimeType,
    fileSizeBytes: photo.fileSizeBytes,
    width: photo.width,
    height: photo.height,
    sortOrder: photo.sortOrder,
    status: photo.status,
    blurHash: photo.blurHash,
    createdAt: photo.createdAt,
  }
}
