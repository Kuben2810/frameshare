import sharp from "sharp"
import { PhotoEditRecipe, DEFAULT_CROP_BOX } from "./ai-photo-analyzer"
import { getDecodableImageBuffer } from "./raw-decoder"

// Low memory setting
sharp.cache(false)
sharp.concurrency(1)

export interface RenderedPhotoOutputs {
  masterJpeg: Buffer
  displayWebp: Buffer
  thumbWebp: Buffer
  width: number
  height: number
}

/**
 * Server-side Sharp rendering pipeline for non-destructive PhotoEditRecipe
 */
export async function renderEditedPhotoBuffer(
  inputBuffer: Buffer,
  filename: string,
  recipe: PhotoEditRecipe
): Promise<RenderedPhotoOutputs> {
  // Step 1: Decode RAW if applicable
  const { buffer: decodableBuffer } = await getDecodableImageBuffer(inputBuffer, filename)

  // Step 2: Initialize Sharp instance
  let pipeline = sharp(Buffer.from(decodableBuffer))
  const metadata = await pipeline.metadata()
  let naturalW = metadata.width || 2000
  let naturalH = metadata.height || 1500

  // Step 3: Rotation & Flips
  if (recipe.rotation) {
    pipeline = pipeline.rotate(recipe.rotation)
    if (recipe.rotation === 90 || recipe.rotation === 270) {
      const temp = naturalW
      naturalW = naturalH
      naturalH = temp
    }
  }

  if (recipe.flipH) {
    pipeline = pipeline.flop()
  }
  if (recipe.flipV) {
    pipeline = pipeline.flip()
  }

  // Step 4: Straighten / Horizon Rotation if non-zero
  if (recipe.straighten && Math.abs(recipe.straighten) > 0.1) {
    pipeline = pipeline.rotate(recipe.straighten, { background: "#000000" })
  }

  // Step 5: Cropping
  const crop = recipe.cropBox || DEFAULT_CROP_BOX
  const isCropped =
    crop.x > 0 || crop.y > 0 || crop.width < 100 || crop.height < 100

  if (isCropped) {
    const left = Math.max(0, Math.min(naturalW - 10, Math.round((crop.x / 100) * naturalW)))
    const top = Math.max(0, Math.min(naturalH - 10, Math.round((crop.y / 100) * naturalH)))
    const width = Math.max(10, Math.min(naturalW - left, Math.round((crop.width / 100) * naturalW)))
    const height = Math.max(10, Math.min(naturalH - top, Math.round((crop.height / 100) * naturalH)))

    pipeline = pipeline.extract({ left, top, width, height })
    naturalW = width
    naturalH = height
  }

  // Step 6: Color & Tonal Adjustments (Exposure, Contrast, Saturation)
  const brightness = Math.max(0.1, 1 + recipe.exposure * 0.35)
  const saturation = Math.max(
    0.01,
    1 + (recipe.saturation + recipe.vibrance * 0.5) * 0.01
  )

  pipeline = pipeline.modulate({
    brightness,
    saturation,
  })

  // Contrast boost/reduction via gamma
  if (recipe.contrast !== 0) {
    const gammaValue = recipe.contrast > 0 ? 1 - recipe.contrast * 0.004 : 1 - recipe.contrast * 0.005
    pipeline = pipeline.gamma(Math.max(0.4, Math.min(2.5, gammaValue)))
  }

  // Step 7: Sharpening (Unsharp Mask)
  if ((recipe.sharpening ?? 0) > 0) {
    const sigma = recipe.sharpenRadius || 1.0
    const m1 = Math.max(0.5, ((recipe.sharpening ?? 15) / 100) * 2.5)
    pipeline = pipeline.sharpen({
      sigma,
      m1,
      m2: 2.0,
      x1: 2.0,
      y2: 10.0,
      y3: 20.0,
    })
  }

  // Render Master JPEG (Full Res)
  const masterJpeg = await pipeline
    .clone()
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()

  // Render Web Display WebP (max 2560px)
  const displayWebp = await pipeline
    .clone()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer()

  // Render Thumbnail WebP (max 600px)
  const thumbWebp = await pipeline
    .clone()
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return {
    masterJpeg,
    displayWebp,
    thumbWebp,
    width: naturalW,
    height: naturalH,
  }
}
