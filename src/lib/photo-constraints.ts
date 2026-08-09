export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/tiff", "image/webp"]
export const MAX_SIZE_BYTES = 50 * 1024 * 1024

export function validatePhoto(file: { type: string; size: number }): { ok: boolean; error?: string } {
  if (!ACCEPTED_TYPES.includes(file.type)) return { ok: false, error: "Invalid file type" }
  if (!file.size || file.size > MAX_SIZE_BYTES) return { ok: false, error: "File too large" }
  return { ok: true }
}
