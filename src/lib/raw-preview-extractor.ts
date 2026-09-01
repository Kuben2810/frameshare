/**
 * Ultra-fast camera RAW preview extractor for Sony (.ARW), Canon (.CR2, .CR3),
 * Nikon (.NEF), Adobe (.DNG), Fuji (.RAF), Olympus (.ORF), Panasonic (.RW2),
 * with built-in EXIF Orientation auto-rotation and normalization.
 */

const RAW_EXTENSIONS = new Set([
  "arw",
  "cr2",
  "cr3",
  "nef",
  "dng",
  "raf",
  "orf",
  "rw2",
  "pef",
  "srw",
  "raw",
])

export function isRawFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return RAW_EXTENSIONS.has(ext)
}

/**
 * Fast binary EXIF Orientation parser.
 * Returns:
 *  1 = 0° Normal
 *  3 = 180°
 *  6 = 90° CW (Portrait right)
 *  8 = 270° CW / 90° CCW (Portrait left)
 */
export function getExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1

  let offset = 2
  const length = Math.min(bytes.length, 65536) // Search within first 64KB

  while (offset < length - 4) {
    if (bytes[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = bytes[offset + 1]

    if (marker === 0xe1) {
      // APP1 (Exif) marker
      const exifStart = offset + 4
      if (
        bytes[exifStart] === 0x45 && // E
        bytes[exifStart + 1] === 0x78 && // x
        bytes[exifStart + 2] === 0x69 && // i
        bytes[exifStart + 3] === 0x66 && // f
        bytes[exifStart + 4] === 0x00 &&
        bytes[exifStart + 5] === 0x00
      ) {
        const tiffStart = exifStart + 6
        const isLittleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49

        const get16 = (pos: number) =>
          isLittleEndian ? bytes[pos] | (bytes[pos + 1] << 8) : (bytes[pos] << 8) | bytes[pos + 1]
        const get32 = (pos: number) =>
          isLittleEndian
            ? bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)
            : (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]

        const ifd0Offset = get32(tiffStart + 4)
        let dirPos = tiffStart + ifd0Offset
        if (dirPos >= bytes.length - 2) return 1

        const entries = get16(dirPos)
        dirPos += 2

        for (let i = 0; i < entries && dirPos < bytes.length - 12; i++) {
          const tag = get16(dirPos)
          if (tag === 0x0112) {
            // Orientation tag
            return get16(dirPos + 8)
          }
          dirPos += 12
        }
      }
      return 1
    } else if (marker === 0xd9 || marker === 0xda) {
      break
    } else {
      const markerLength = (bytes[offset + 2] << 8) | bytes[offset + 3]
      offset += 2 + markerLength
    }
  }

  return 1
}

/**
 * Fast O(N) single-pass search for embedded JPEG preview in RAW binary buffer.
 */
export function extractEmbeddedJpegFromBuffer(buffer: ArrayBuffer): { blob: Blob; orientation: number } | null {
  const bytes = new Uint8Array(buffer)
  const len = bytes.length

  let largestBlob: Blob | null = null
  let maxSegmentSize = 0
  let detectedOrientation = 1
  let currentStart = -1

  for (let i = 0; i < len - 3; i++) {
    // Check for JPEG SOI (Start of Image): 0xFF 0xD8 0xFF
    if (currentStart === -1 && bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      currentStart = i
      i += 2
      continue
    }

    // Check for JPEG EOI (End of Image): 0xFF 0xD9
    if (currentStart !== -1 && bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      const end = i + 2
      const size = end - currentStart

      // Keep if larger than 30KB (filters out tiny thumbnails and finds full-size master preview)
      if (size > 30720 && size > maxSegmentSize) {
        maxSegmentSize = size
        const jpegBytes = bytes.subarray(currentStart, end)
        detectedOrientation = getExifOrientation(jpegBytes)
        largestBlob = new Blob([jpegBytes], { type: "image/jpeg" })
      }

      currentStart = -1
      i += 1
    }
  }

  if (largestBlob) {
    return { blob: largestBlob, orientation: detectedOrientation }
  }
  return null
}

/**
 * Auto-rotates image onto an HTML5 Canvas if EXIF orientation indicates it was shot vertically or upside down.
 */
export async function normalizeImageOrientation(
  blobOrFile: Blob | File,
  forcedOrientation?: number
): Promise<{ url: string; orientationDeg: number }> {
  const buffer = await blobOrFile.arrayBuffer()
  const orientation = forcedOrientation ?? getExifOrientation(new Uint8Array(buffer))

  let orientationDeg = 0
  if (orientation === 6) orientationDeg = 90
  else if (orientation === 3) orientationDeg = 180
  else if (orientation === 8) orientationDeg = 270

  // If orientation is standard 1 (0 deg), return direct object URL
  if (orientationDeg === 0) {
    return {
      url: URL.createObjectURL(blobOrFile),
      orientationDeg: 0,
    }
  }

  // Auto-normalize orientation onto a clean upright canvas
  try {
    const rawUrl = URL.createObjectURL(blobOrFile)
    const img = new Image()
    img.src = rawUrl
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject()
    })

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas context unavailable")

    const w = img.naturalWidth
    const h = img.naturalHeight

    if (orientationDeg === 90 || orientationDeg === 270) {
      canvas.width = h
      canvas.height = w
    } else {
      canvas.width = w
      canvas.height = h
    }

    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((orientationDeg * Math.PI) / 180)
    ctx.drawImage(img, -w / 2, -h / 2)
    URL.revokeObjectURL(rawUrl)

    const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/jpeg", 0.96)
    })

    return {
      url: URL.createObjectURL(normalizedBlob),
      orientationDeg,
    }
  } catch {
    // fallback to raw URL
    return {
      url: URL.createObjectURL(blobOrFile),
      orientationDeg,
    }
  }
}

/**
 * Client-side file decoder that handles standard images and Camera RAW files seamlessly
 * with automatic EXIF orientation normalization.
 */
export async function decodePhotoOrRawFile(
  file: File
): Promise<{ url: string; isRaw: boolean; success: boolean; initialRotation: number }> {
  if (!isRawFile(file.name)) {
    const { url, orientationDeg } = await normalizeImageOrientation(file)
    return {
      url,
      isRaw: false,
      success: true,
      initialRotation: 0, // already normalized to 0 deg upright
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = extractEmbeddedJpegFromBuffer(arrayBuffer)
    if (result) {
      const { url } = await normalizeImageOrientation(result.blob, result.orientation)
      return {
        url,
        isRaw: true,
        success: true,
        initialRotation: 0,
      }
    }
  } catch (err) {
    console.warn("Client RAW extraction error:", err)
  }

  // Fallback to direct file normalizer
  const { url } = await normalizeImageOrientation(file)
  return {
    url,
    isRaw: true,
    success: true,
    initialRotation: 0,
  }
}
