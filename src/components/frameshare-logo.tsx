import React from "react"

interface FrameshareLogoProps {
  className?: string
  iconHeight?: number
  showText?: boolean
  textSize?: "sm" | "md" | "lg"
}

export function FrameshareLogo({
  className = "",
  iconHeight = 32,
  showText = true,
  textSize = "md",
}: FrameshareLogoProps) {
  const fontSizes = {
    sm: "text-base tracking-[0.15em]",
    md: "text-lg sm:text-xl tracking-[0.18em]",
    lg: "text-2xl sm:text-3xl tracking-[0.2em]",
  }

  const subFontSizes = {
    sm: "text-[9px] tracking-[0.25em]",
    md: "text-[10px] sm:text-[11px] tracking-[0.3em]",
    lg: "text-[12px] tracking-[0.35em]",
  }

  // Camera aspect ratio is 100:68
  const iconWidth = Math.round((iconHeight * 100) / 68)

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {/* ── Bold Standalone Concept 1 Camera Aperture Mark ── */}
      <div
        className="relative shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
        style={{ width: iconWidth, height: iconHeight }}
      >
        <svg
          viewBox="0 0 100 68"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
        >
          {/* Main Camera Body Silhouette with Top Shutter Bump */}
          <path
            d="M18 10H34L36 5H64L66 10H82C89.7279 10 96 16.2721 96 24V54C96 61.7279 89.7279 68 82 68H18C10.2721 68 4 61.7279 4 54V24C4 16.2721 10.2721 10 18 10Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground"
          />

          {/* Left Focus Bracket Tick Marks */}
          <path d="M12 28H19V20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground" />
          <path d="M12 48H19V56" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground" />

          {/* Right Focus Bracket Tick Marks */}
          <path d="M88 28H81V20" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground" />
          <path d="M88 48H81V56" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground" />

          {/* Interlocking Dual-Frame Loops ("Frame" + "Share") */}
          <path
            d="M18 24H48C58 24 63 31 63 39C63 47 58 54 48 54H18C10 54 8 47 8 39C8 31 10 24 18 24Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.3"
            className="text-foreground"
          />
          <path
            d="M82 24H52C42 24 37 31 37 39C37 47 42 54 52 54H82C90 54 92 47 92 39C92 31 90 24 82 24Z"
            stroke="#F59E0B"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />

          {/* Central Champagne Gold Aperture Ring */}
          <circle cx="50" cy="39" r="16" stroke="#F59E0B" strokeWidth="4.5" />

          {/* 6 Interlocking Aperture Shutter Blades */}
          <path d="M50 23 L59 34" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M65 31 L59 46" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M65 47 L50 47" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M50 55 L41 46" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M35 47 L41 34" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M35 31 L50 31" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" />

          {/* Central Gold Focal Point */}
          <circle cx="50" cy="39" r="3.5" fill="#F59E0B" />
        </svg>
      </div>

      {/* ── High-Contrast Wordmark ── */}
      {showText && (
        <div className="flex flex-col text-left justify-center">
          <span
            className={`font-bold uppercase text-foreground font-oswald leading-none tracking-wider ${fontSizes[textSize]}`}
          >
            Frameshare
          </span>
          <span
            className={`font-bold uppercase text-amber-500 dark:text-amber-400 font-mono mt-1 leading-none ${subFontSizes[textSize]}`}
          >
            Studio Platform
          </span>
        </div>
      )}
    </div>
  )
}

