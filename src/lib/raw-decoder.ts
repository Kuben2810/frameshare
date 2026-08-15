import sharp from "sharp"

/**
 * Robust EXIF Orientation tag extractor.
 * Scans TIFF IFDs (IFD0, IFD1, ExifIFD) and searches for Tag 0x0112 across raw headers.
 * Returns 1 (normal), 3 (180°), 6 (90° CW), 8 (270° CW), or null if not found.
 */
export function extractRawOrientation(buffer: Buffer): number | null {
  if (buffer.length < 16) return null

  // 1. Structured TIFF IFD parser
  const isLittleEndian = buffer[0] === 0x49 && buffer[1] === 0x49 // "II"
  const isBigEndian = buffer[0] === 0x4d && buffer[1] === 0x4d // "MM"

  if (isLittleEndian || isBigEndian) {
    const readU16 = (pos: number) => (isLittleEndian ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos))
    const readU32 = (pos: number) => (isLittleEndian ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos))

    const magic = readU16(2)
    if (magic === 42 || magic === 0x4352 || magic === 0x55) {
      let ifdOffset = readU32(4)
      let visited = 0

      while (ifdOffset >= 8 && ifdOffset + 2 < buffer.length && visited < 10) {
        visited++
        const numEntries = readU16(ifdOffset)
        let pos = ifdOffset + 2
        let exifIfdOffset: number | null = null

        for (let i = 0; i < numEntries; i++) {
          if (pos + 12 > buffer.length) break
          const tag = readU16(pos)
          if (tag === 0x0112) {
            const val = readU16(pos + 8)
            if (val >= 1 && val <= 8) return val
          }
          if (tag === 0x8769) {
            // Exif SubIFD
            exifIfdOffset = readU32(pos + 8)
          }
          pos += 12
        }

        if (exifIfdOffset && exifIfdOffset >= 8 && exifIfdOffset + 2 < buffer.length) {
          const exifEntries = readU16(exifIfdOffset)
          let ePos = exifIfdOffset + 2
          for (let i = 0; i < exifEntries; i++) {
            if (ePos + 12 > buffer.length) break
            const tag = readU16(ePos)
            if (tag === 0x0112) {
              const val = readU16(ePos + 8)
              if (val >= 1 && val <= 8) return val
            }
            ePos += 12
          }
        }

        if (pos + 4 <= buffer.length) {
          ifdOffset = readU32(pos)
        } else {
          break
        }
      }
    }
  }

  // 2. High-speed binary tag scanner across the first 128KB header
  // Search for TIFF Tag 0x0112 (SHORT, count 1)
  const scanLimit = Math.min(buffer.length - 12, 131072)
  for (let i = 0; i < scanLimit; i++) {
    // Little Endian: 12 01 03 00 01 00 00 00 [val] 00
    if (
      buffer[i] === 0x12 &&
      buffer[i + 1] === 0x01 &&
      buffer[i + 2] === 0x03 &&
      buffer[i + 3] === 0x00 &&
      buffer[i + 4] === 0x01 &&
      buffer[i + 5] === 0x00 &&
      buffer[i + 6] === 0x00 &&
      buffer[i + 7] === 0x00
    ) {
      const val = buffer.readUInt16LE(i + 8)
      if (val >= 1 && val <= 8) return val
    }
    // Big Endian: 01 12 00 03 00 00 00 01 00 [val]
    if (
      buffer[i] === 0x01 &&
      buffer[i + 1] === 0x12 &&
      buffer[i + 2] === 0x00 &&
      buffer[i + 3] === 0x03 &&
      buffer[i + 4] === 0x00 &&
      buffer[i + 5] === 0x00 &&
      buffer[i + 6] === 0x00 &&
      buffer[i + 7] === 0x01
    ) {
      const val = buffer.readUInt16BE(i + 8)
      if (val >= 1 && val <= 8) return val
    }
  }

  return null
}

/**
 * Extracts embedded JPEG images by reading TIFF IFD tags:
 * 0x0111 (StripOffsets), 0x0117 (StripByteCounts),
 * 0x0201 (JPEGInterchangeFormat), 0x0202 (JPEGInterchangeFormatLength),
 * 0x014A (SubIFDs), 0x8769 (ExifIFD).
 * Canon CR2 stores the full-res master JPEG in IFD2, Nikon NEF in SubIFD, Sony ARW in IFD0/SubIFD.
 */
export function extractJpegsFromTiffIfds(buffer: Buffer): Buffer[] {
  if (buffer.length < 16) return []

  const isLittleEndian = buffer[0] === 0x49 && buffer[1] === 0x49 // "II"
  const isBigEndian = buffer[0] === 0x4d && buffer[1] === 0x4d // "MM"
  if (!isLittleEndian && !isBigEndian) return []

  const readU16 = (pos: number) => (isLittleEndian ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos))
  const readU32 = (pos: number) => (isLittleEndian ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos))

  const jpegs: Buffer[] = []
  const ifdOffsetsToVisit: number[] = []
  const visited = new Set<number>()

  // IFD0 from header
  const ifd0 = readU32(4)
  if (ifd0 >= 8 && ifd0 < buffer.length) ifdOffsetsToVisit.push(ifd0)

  // In Canon CR2, bytes 12-15 is rawIfdOffset
  if (buffer.length >= 16) {
    const rawIfd = readU32(12)
    if (rawIfd >= 8 && rawIfd < buffer.length) ifdOffsetsToVisit.push(rawIfd)
  }

  while (ifdOffsetsToVisit.length > 0) {
    const ifdOffset = ifdOffsetsToVisit.shift()!
    if (visited.has(ifdOffset) || ifdOffset < 8 || ifdOffset + 2 >= buffer.length) continue
    visited.add(ifdOffset)

    const numEntries = readU16(ifdOffset)
    let pos = ifdOffset + 2

    let stripOffset: number | null = null
    let stripByteCount: number | null = null
    let jpegOffset: number | null = null
    let jpegLength: number | null = null

    for (let i = 0; i < numEntries; i++) {
      if (pos + 12 > buffer.length) break
      const tag = readU16(pos)
      const type = readU16(pos + 2)
      const count = readU32(pos + 4)
      const valOrOffset = readU32(pos + 8)

      const getVal = () => {
        if (type === 3 && count === 1) return readU16(pos + 8)
        if (type === 4 && count === 1) return valOrOffset
        if (valOrOffset >= 8 && valOrOffset + 4 <= buffer.length) {
          return type === 3 ? readU16(valOrOffset) : readU32(valOrOffset)
        }
        return valOrOffset
      }

      if (tag === 0x0111) stripOffset = getVal()
      if (tag === 0x0117) stripByteCount = getVal()
      if (tag === 0x0201) jpegOffset = getVal()
      if (tag === 0x0202) jpegLength = getVal()

      // SubIFDs (0x014A) or ExifIFD (0x8769)
      if ((tag === 0x014A || tag === 0x8769) && count >= 1) {
        if (count === 1) {
          if (valOrOffset >= 8 && valOrOffset < buffer.length) ifdOffsetsToVisit.push(valOrOffset)
        } else if (valOrOffset >= 8 && valOrOffset + count * 4 <= buffer.length) {
          for (let s = 0; s < Math.min(count, 16); s++) {
            const subOffset = readU32(valOrOffset + s * 4)
            if (subOffset >= 8 && subOffset < buffer.length) ifdOffsetsToVisit.push(subOffset)
          }
        }
      }

      pos += 12
    }

    // Next IFD
    if (pos + 4 <= buffer.length) {
      const nextIfd = readU32(pos)
      if (nextIfd >= 8 && nextIfd < buffer.length && !visited.has(nextIfd)) {
        ifdOffsetsToVisit.push(nextIfd)
      }
    }

    // Check if this IFD pointed to a JPEG
    const targetOffset = jpegOffset ?? stripOffset
    const targetLength = jpegLength ?? stripByteCount

    if (targetOffset && targetLength && targetLength > 1024) {
      if (targetOffset >= 0 && targetOffset + targetLength <= buffer.length) {
        if (buffer[targetOffset] === 0xff && buffer[targetOffset + 1] === 0xd8) {
          jpegs.push(buffer.subarray(targetOffset, targetOffset + targetLength))
        }
      }
    }
  }

  return jpegs
}

/**
 * Extracts all embedded JPEG buffers from a camera RAW file by scanning SOI markers.
 */
export function extractJpegsFromRaw(buffer: Buffer): Buffer[] {
  const jpegs: Buffer[] = []
  
  // Find all SOI locations (0xFF 0xD8 0xFF)
  const soiOffsets: number[] = []
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      soiOffsets.push(i)
    }
  }

  for (let idx = 0; idx < soiOffsets.length; idx++) {
    const start = soiOffsets[idx]
    const nextStart = idx + 1 < soiOffsets.length ? soiOffsets[idx + 1] : buffer.length
    
    // Find the last EOI (0xFF 0xD9) before the next SOI
    let lastEoi = -1
    for (let j = Math.max(start + 100, nextStart - 4096); j < nextStart - 1; j++) {
      if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
        lastEoi = j
      }
    }
    
    if (lastEoi === -1) {
      for (let j = start + 100; j < nextStart - 1; j++) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          lastEoi = j
        }
      }
    }

    if (lastEoi !== -1 && lastEoi + 2 - start > 4096) {
      jpegs.push(buffer.subarray(start, lastEoi + 2))
    } else if (nextStart - start > 4096) {
      jpegs.push(buffer.subarray(start, nextStart))
    }
  }

  return jpegs
}

/**
 * Converts a raw or standard image buffer into a Sharp-readable image buffer.
 * For Canon CR2, Nikon NEF, Sony ARW, Adobe DNG, etc., selects the HIGHEST RESOLUTION full-frame master preview.
 */
export async function getDecodableImageBuffer(buffer: Buffer, filename?: string): Promise<Buffer> {
  const ext = filename?.split(".").pop()?.toLowerCase() ?? ""
  const isRawExt = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2", "pef", "srw", "raw"].includes(ext)

  // 1. For RAW files, gather all candidates from TIFF IFDs and binary SOI/EOI scanning
  if (isRawExt) {
    const candidates: Buffer[] = [
      ...extractJpegsFromTiffIfds(buffer),
      ...extractJpegsFromRaw(buffer),
    ]

    const validCandidates: { buf: Buffer; width: number; height: number; pixels: number }[] = []

    for (const buf of candidates) {
      try {
        const meta = await sharp(buf).metadata()
        if (meta.width && meta.height && meta.width > 200 && meta.height > 200) {
          validCandidates.push({
            buf,
            width: meta.width,
            height: meta.height,
            pixels: meta.width * meta.height,
          })
        }
      } catch {
        continue
      }
    }

    if (validCandidates.length > 0) {
      // Sort by HIGHEST RESOLUTION (megapixels) so we get the full-res master preview (e.g. 5472x3648 / 6000x4000)
      validCandidates.sort((a, b) => b.pixels - a.pixels)
      return validCandidates[0].buf
    }
  }

  // 2. For standard formats (JPG, PNG, WebP, TIFF), decode with Sharp
  try {
    const meta = await sharp(buffer).metadata()
    if (meta && meta.width && meta.height) {
      return buffer
    }
  } catch {
    const candidates = [
      ...extractJpegsFromTiffIfds(buffer),
      ...extractJpegsFromRaw(buffer),
    ]
    const validCandidates: { buf: Buffer; pixels: number }[] = []
    for (const buf of candidates) {
      try {
        const meta = await sharp(buf).metadata()
        if (meta.width && meta.height) {
          validCandidates.push({ buf, pixels: meta.width * meta.height })
        }
      } catch {
        continue
      }
    }
    if (validCandidates.length > 0) {
      validCandidates.sort((a, b) => b.pixels - a.pixels)
      return validCandidates[0].buf
    }
  }

  return buffer
}
