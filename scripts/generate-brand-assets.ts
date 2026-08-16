import fs from "fs"
import path from "path"
import sharp from "sharp"

const BRAND_DIR = path.join(process.cwd(), "public", "brand")
if (!fs.existsSync(BRAND_DIR)) {
  fs.mkdirSync(BRAND_DIR, { recursive: true })
}

// ── SVG for Icon Mark (Concept 1: Bold Camera Body, Interlocking Loops & Gold Aperture) ──
function getIconSvg(colorMode: "white-gold" | "dark-gold" = "white-gold"): string {
  const isDark = colorMode === "dark-gold"
  const bodyStroke = isDark ? "#17171B" : "#FFFFFF"
  const goldColor = "#F59E0B"
  const bladeColor = "#FBBF24"

  return `<svg width="1024" height="1024" viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Camera Body Silhouette & Shutter Bump -->
    <path d="M18 10H34L36 5H64L66 10H82C89.7279 10 96 16.2721 96 24V54C96 61.7279 89.7279 68 82 68H18C10.2721 68 4 61.7279 4 54V24C4 16.2721 10.2721 10 18 10Z" stroke="${bodyStroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Focus Brackets Left -->
    <path d="M12 28H19V20" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 48H19V56" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Focus Brackets Right -->
    <path d="M88 28H81V20" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M88 48H81V56" stroke="${bodyStroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Interlocking Dual-Frame Loops -->
    <path d="M18 24H48C58 24 63 31 63 39C63 47 58 54 48 54H18C10 54 8 47 8 39C8 31 10 24 18 24Z" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
    <path d="M82 24H52C42 24 37 31 37 39C37 47 42 54 52 54H82C90 54 92 47 92 39C92 31 90 24 82 24Z" stroke="${goldColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>

    <!-- Central Gold Aperture Ring & Blades -->
    <circle cx="50" cy="39" r="16" stroke="${goldColor}" stroke-width="4.5"/>
    
    <!-- 6 Interlocking Aperture Blades -->
    <path d="M50 23 L59 34" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M65 31 L59 46" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M65 47 L50 47" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M50 55 L41 46" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M35 47 L41 34" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M35 31 L50 31" stroke="${bladeColor}" stroke-width="2.8" stroke-linecap="round"/>

    <!-- Inner Aperture Focal Core -->
    <circle cx="50" cy="39" r="3.5" fill="${goldColor}"/>
  </svg>`
}

// ── SVG for Full Horizontal Logo with Oswald & Mono Wordmark ──
function getFullLogoSvg(colorMode: "white-gold" | "dark-gold" = "white-gold"): string {
  const isDark = colorMode === "dark-gold"
  const textPrimary = isDark ? "#0A0A0B" : "#FFFFFF"
  const bodyStroke = isDark ? "#17171B" : "#FFFFFF"
  const goldColor = "#F59E0B"
  const bladeColor = "#FBBF24"

  return `<svg width="2400" height="700" viewBox="0 0 600 175" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Icon Container on Left -->
    <g transform="translate(20, 28) scale(1.65)">
      <!-- Camera Body Silhouette & Shutter Bump -->
      <path d="M18 10H34L36 5H64L66 10H82C89.7279 10 96 16.2721 96 24V54C96 61.7279 89.7279 68 82 68H18C10.2721 68 4 61.7279 4 54V24C4 16.2721 10.2721 10 18 10Z" stroke="${bodyStroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Focus Brackets Left -->
      <path d="M12 28H19V20" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 48H19V56" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Focus Brackets Right -->
      <path d="M88 28H81V20" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M88 48H81V56" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Interlocking Dual-Frame Loops -->
      <path d="M18 24H48C58 24 63 31 63 39C63 47 58 54 48 54H18C10 54 8 47 8 39C8 31 10 24 18 24Z" stroke="${bodyStroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
      <path d="M82 24H52C42 24 37 31 37 39C37 47 42 54 52 54H82C90 54 92 47 92 39C92 31 90 24 82 24Z" stroke="${goldColor}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>

      <!-- Central Gold Aperture Ring & Blades -->
      <circle cx="50" cy="39" r="16" stroke="${goldColor}" stroke-width="4.2"/>
      
      <!-- 6 Interlocking Aperture Blades -->
      <path d="M50 23 L59 34" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M65 31 L59 46" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M65 47 L50 47" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M50 55 L41 46" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M35 47 L41 34" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M35 31 L50 31" stroke="${bladeColor}" stroke-width="2.6" stroke-linecap="round"/>

      <!-- Inner Aperture Focal Core -->
      <circle cx="50" cy="39" r="3.2" fill="${goldColor}"/>
    </g>

    <!-- Typography Wordmark on Right -->
    <g transform="translate(205, 26)">
      <!-- Main Brand Name (FRAMESHARE) -->
      <text x="0" y="66" font-family="Oswald, sans-serif" font-weight="700" font-size="64" letter-spacing="8" fill="${textPrimary}">FRAMESHARE</text>
      
      <!-- Subtitle Tagline -->
      <text x="4" y="98" font-family="'Courier New', monospace" font-weight="700" font-size="14" letter-spacing="6" fill="${goldColor}">STUDIO PLATFORM</text>
    </g>
  </svg>`
}

async function main() {
  console.log("Generating high-resolution Concept 1 brand assets...")

  // 1. Export High-Res SVG files
  fs.writeFileSync(path.join(BRAND_DIR, "frameshare-icon-white-gold.svg"), getIconSvg("white-gold"))
  fs.writeFileSync(path.join(BRAND_DIR, "frameshare-icon-dark-gold.svg"), getIconSvg("dark-gold"))
  fs.writeFileSync(path.join(BRAND_DIR, "frameshare-logo-white-gold.svg"), getFullLogoSvg("white-gold"))
  fs.writeFileSync(path.join(BRAND_DIR, "frameshare-logo-dark-gold.svg"), getFullLogoSvg("dark-gold"))

  // 2. Export 1024x1024 Transparent PNG Icons
  await sharp(Buffer.from(getIconSvg("white-gold")))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(BRAND_DIR, "frameshare-icon-1024-white.png"))

  await sharp(Buffer.from(getIconSvg("dark-gold")))
    .resize(1024, 1024)
    .png()
    .toFile(path.join(BRAND_DIR, "frameshare-icon-1024-dark.png"))

  // 3. Export 512x512 App Icon and 192x192 favicon
  await sharp(Buffer.from(getIconSvg("white-gold")))
    .resize(512, 512)
    .png()
    .toFile(path.join(process.cwd(), "public", "icon.png"))

  await sharp(Buffer.from(getIconSvg("white-gold")))
    .resize(192, 192)
    .png()
    .toFile(path.join(process.cwd(), "public", "favicon.png"))

  // 4. Export High-Res 2400x700 Transparent PNG Full Logos
  await sharp(Buffer.from(getFullLogoSvg("white-gold")))
    .resize(2400, 700)
    .png()
    .toFile(path.join(BRAND_DIR, "frameshare-logo-2400-white-gold.png"))

  await sharp(Buffer.from(getFullLogoSvg("dark-gold")))
    .resize(2400, 700)
    .png()
    .toFile(path.join(BRAND_DIR, "frameshare-logo-2400-dark-gold.png"))

  // 5. Default root logo.png (high-res transparent)
  await sharp(Buffer.from(getFullLogoSvg("white-gold")))
    .resize(1200, 350)
    .png()
    .toFile(path.join(process.cwd(), "public", "logo.png"))

  console.log("✅ All high-resolution transparent PNG and SVG assets created in public/brand/ and public/")
}

main().catch(console.error)
