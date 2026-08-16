export const s3Keys = (photoId: string) => ({
  original: (ext: string) => `photos/${photoId}/original.${ext}`,
  thumb: () => `photos/${photoId}/thumb.webp`,
  display: () => `photos/${photoId}/display.webp`,
  watermarked: () => `photos/${photoId}/watermarked.jpg`,
  finalDisplay: () => `photos/${photoId}/final-display.webp`,
  finalMaster: () => `photos/${photoId}/final-master.jpg`,
})
