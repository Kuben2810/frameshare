export const STANDARD_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "tif", "tiff"]
export const RAW_EXTENSIONS = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2", "pef", "srw", "raw"]
export const ACCEPTED_EXTENSIONS = [...STANDARD_EXTENSIONS, ...RAW_EXTENSIONS]

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/x-canon-cr2",
  "image/x-canon-cr3",
  "image/x-nikon-nef",
  "image/x-sony-arw",
  "image/x-adobe-dng",
  "image/x-fuji-raf",
  "image/x-panasonic-raw",
  "image/x-olympus-orf",
  "image/x-raw",
  "application/octet-stream",
  "",
]

export const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB per RAW / master photo

export function validatePhoto(file: { name?: string; type?: string; size: number }): { ok: boolean; error?: string } {
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? ""
  const isValidExt = ACCEPTED_EXTENSIONS.includes(ext)
  const isValidMime = !file.type || ACCEPTED_TYPES.includes(file.type) || file.type.startsWith("image/")

  if (!isValidExt && !isValidMime) {
    return {
      ok: false,
      error: `Unsupported file format (.${ext || file.type}). Supported: JPG, PNG, WebP, TIFF, CR2, CR3, NEF, ARW, DNG, RAF`,
    }
  }

  if (!file.size || file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File exceeds 100 MB size limit" }
  }

  return { ok: true }
}
