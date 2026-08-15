import sharp from "sharp"

/**
 * Extracts all embedded JPEG buffers from a camera RAW file (Canon CR2/CR3, Nikon NEF, Sony ARW, Adobe DNG, etc.)
 * by scanning for standard JPEG SOI (FF D8 FF) and EOI (FF D9) markers.
 */
export function extractJpegsFromRaw(buffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = []
  let offset = 0

  while (offset < buffer.length - 4) {
    // Search for JPEG SOI: 0xFF 0xD8 0xFF
    if (buffer[offset] === 0xff && buffer[offset + 1] === 0xd8 && buffer[offset + 2] === 0xff) {
      const start = offset
      offset += 3

      // Find corresponding EOI marker: 0xFF 0xD9
      let end = -1
      while (offset < buffer.length - 1) {
        if (buffer[offset] === 0xff && buffer[offset + 1] === 0xd9) {
          end = offset + 2
          break
        }
        offset++
      }

      if (end !== -1 && end - start > 1024) {
        const candidate = buffer.subarray(start, end)
        jpegs.push(candidate)
      }
    } else {
      offset++
    }
  }

  return jpegs
}

/**
 * Converts a raw or standard image buffer into a Sharp-readable image buffer.
 * If the image is a Canon CR2, NEF, ARW, or DNG, it extracts the largest embedded high-res JPEG preview.
 */
export async function getDecodableImageBuffer(buffer: Buffer, filename?: string): Promise<Buffer> {
  const ext = filename?.split(".").pop()?.toLowerCase() ?? ""
  const isRawExt = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2", "pef", "raw"].includes(ext)

  // 1. If not marked as RAW, try Sharp directly first
  if (!isRawExt) {
    try {
      await sharp(buffer).metadata()
      return buffer
    } catch {
      // Fallback to RAW extraction if standard Sharp decode fails
    }
  }

  // 2. Try Sharp directly even for RAW (e.g. DNG or TIFF containers)
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata()
    if (meta && meta.width && meta.height) {
      return buffer
    }
  } catch {
    // Sharp couldn't decode directly, proceed to embedded JPEG extraction
  }

  // 3. Extract embedded JPEG previews from camera RAW container
  const embeddedJpegs = extractJpegsFromRaw(buffer)
  if (embeddedJpegs.length > 0) {
    // Sort by largest byte size (largest is the full/high-res preview)
    embeddedJpegs.sort((a, b) => b.length - a.length)

    for (const jpegBuf of embeddedJpegs) {
      try {
        const meta = await sharp(jpegBuf).metadata()
        if (meta && meta.width && meta.height) {
          return jpegBuf
        }
      } catch {
        continue
      }
    }
  }

  // 4. Return original buffer as fallback
  return buffer
}
