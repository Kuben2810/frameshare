import fs from "fs"
import path from "path"
import sharp from "sharp"

const BRAND_DIR = path.join(process.cwd(), "public", "brand")
if (!fs.existsSync(BRAND_DIR)) {
  fs.mkdirSync(BRAND_DIR, { recursive: true })
}

// ── SVG for Icon Mark (Concept 1: Camera Body, Interlocking Loops & Gold Aperture) ──
function getIconSvg(colorMode: "white-gold" | "dark-gold" = "white-gold"): string {
  const isDark = colorMode === "dark-gold"
  const bodyStroke = isDark ? "#17171B" : "#FFFFFF"
  const goldColor = "#E5C158"

  return `<svg width="1024" height="1024" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Camera Body Silhouette & Shutter Bump -->
    <path d="M42 22H52L54 26H66L68 22H78C84.6274 22 90 27.3726 90 34V86C90 92.6274 84.6274 98 78 98H42C35.3726 98 30 92.6274 30 86V34C30 27.3726 35.3726 22 42 22Z" stroke="${bodyStroke}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    
    <!-- Left Focus Brackets -->
    <path d="M38 42H44V36" stroke="${bodyStroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <path d="M38 78H44V84" stroke="${bodyStroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>

    <!-- Right Focus Brackets -->
    <path d="M82 42H76V36" stroke="${bodyStroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <path d="M82 78H76V84" stroke="${bodyStroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>

    <!-- Interlocking Dual-Frame Loops -->
    <path d="M42 46H58C68 46 72 54 72 60C72 66 68 74 58 74H42C36 74 34 68 34 60C34 52 36 46 42 46Z" stroke="${bodyStroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
    <path d="M78 46H62C52 46 48 54 48 60C48 66 52 74 62 74H78C84 74 86 68 86 60C86 52 84 46 78 46Z" stroke="${goldColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>

    <!-- Central Gold Aperture Ring & Blades -->
    <circle cx="60" cy="60" r="17" stroke="${goldColor}" stroke-width="4"/>
    
    <!-- 6 Interlocking Aperture Blades -->
    <path d="M60 43 L69 54" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M75 51 L69 66" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M75 69 L60 69" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M60 77 L51 66" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M45 69 L51 54" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M45 51 L60 51" stroke="${goldColor}" stroke-width="2.2" stroke-linecap="round"/>

    <!-- Inner Aperture Hexagonal Focal Core -->
    <circle cx="60" cy="60" r="3.5" fill="${goldColor}"/>
  </svg>`
}

// ── SVG for Full Horizontal Logo with Oswald & Mono Wordmark ──
function getFullLogoSvg(colorMode: "white-gold" | "dark-gold" = "white-gold"): string {
  const isDark = colorMode === "dark-gold"
  const textPrimary = isDark ? "#0A0A0B" : "#FFFFFF"
  const bodyStroke = isDark ? "#17171B" : "#FFFFFF"
  const goldColor = "#E5C158"

  return `<svg width="2400" height="700" viewBox="0 0 600 175" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Icon Container on Left -->
    <g transform="translate(15, 12.5)">
      <!-- Camera Body Silhouette -->
      <path d="M42 26H56L58 31H92L94 26H108C116.837 26 124 33.1634 124 42V108C124 116.837 116.837 124 108 124H42C33.1634 124 26 116.837 26 108V42C26 33.1634 33.1634 26 42 26Z" stroke="${bodyStroke}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Focus Brackets Left -->
      <path d="M38 52H46V44" stroke="${bodyStroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
      <path d="M38 98H46V106" stroke="${bodyStroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>

      <!-- Focus Brackets Right -->
      <path d="M112 52H104V44" stroke="${bodyStroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
      <path d="M112 98H104V106" stroke="${bodyStroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>

      <!-- Interlocking Dual-Frame Loops -->
      <path d="M44 58H72C84 58 90 68 90 75C90 82 84 92 72 92H44C36 92 34 84 34 75C34 66 36 58 44 58Z" stroke="${bodyStroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
      <path d="M106 58H78C66 58 60 68 60 75C60 82 66 92 78 92H106C114 92 116 84 116 75C116 66 114 58 106 58Z" stroke="${goldColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>

      <!-- Central Gold Aperture Ring & Blades -->
      <circle cx="75" cy="75" r="23" stroke="${goldColor}" stroke-width="5"/>
      
      <!-- 6 Interlocking Aperture Blades -->
      <path d="M75 52 L87 67" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>
      <path d="M95 63 L87 83" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>
      <path d="M95 87 L75 87" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>
      <path d="M75 98 L63 83" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>
      <path d="M55 87 L63 67" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>
      <path d="M55 63 L75 63" stroke="${goldColor}" stroke-width="3" stroke-linecap="round"/>

      <!-- Inner Aperture Hexagonal Focal Core -->
      <circle cx="75" cy="75" r="4.5" fill="${goldColor}"/>
    </g>

    <!-- Typography Wordmark on Right -->
    <g transform="translate(185, 30)">
      <!-- Main Brand Name (FRAMESHARE) -->
      <text x="0" y="62" font-family="Oswald, sans-serif" font-weight="700" font-size="56" letter-spacing="8" fill="${textPrimary}" text-transform="uppercase">FRAMESHARE</text>
      
      <!-- Subtitle Tagline -->
      <text x="3" y="94" font-family="'Courier New', monospace" font-weight="600" font-size="14" letter-spacing="7" fill="${goldColor}" text-transform="uppercase">PHOTOGRAPHY STUDIO PLATFORM</text>
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
