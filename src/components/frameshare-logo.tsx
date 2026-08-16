import React from "react"

interface FrameshareLogoProps {
  className?: string
  iconSize?: number
  showText?: boolean
  textSize?: "sm" | "md" | "lg"
}

export function FrameshareLogo({
  className = "",
  iconSize = 34,
  showText = true,
  textSize = "md",
}: FrameshareLogoProps) {
  const fontSizes = {
    sm: "text-base tracking-[0.14em]",
    md: "text-lg tracking-[0.18em]",
    lg: "text-2xl tracking-[0.2em]",
  }

  const subFontSizes = {
    sm: "text-[8px] tracking-[0.25em]",
    md: "text-[9px] tracking-[0.3em]",
    lg: "text-[10px] tracking-[0.35em]",
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* ── Frameshare Concept 1 Icon Mark ── */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl bg-neutral-900/90 dark:bg-neutral-950 border border-white/10 text-foreground shadow-md overflow-hidden group-hover:scale-105 transition-transform duration-300"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1"
        >
          {/* Camera Body Silhouette & Shutter Bump */}
          <path
            d="M42 22H52L54 26H66L68 22H78C84.6274 22 90 27.3726 90 34V86C90 92.6274 84.6274 98 78 98H42C35.3726 98 30 92.6274 30 86V34C30 27.3726 35.3726 22 42 22Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Left Focus Brackets */}
          <path d="M38 42H44V36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <path d="M38 78H44V84" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

          {/* Right Focus Brackets */}
          <path d="M82 42H76V36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          <path d="M82 78H76V84" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />

          {/* Interlocking Dual-Frame Loops */}
          <path
            d="M42 46H58C68 46 72 54 72 60C72 66 68 74 58 74H42C36 74 34 68 34 60C34 52 36 46 42 46Z"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
          />
          <path
            d="M78 46H62C52 46 48 54 48 60C48 66 52 74 62 74H78C84 74 86 68 86 60C86 52 84 46 78 46Z"
            stroke="#E5C158"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />

          {/* Central Gold Aperture Ring & Shutter Blades */}
          <circle cx="60" cy="60" r="17" stroke="#E5C158" strokeWidth="4.5" />
          <path d="M60 43 L69 54" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 51 L69 66" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 69 L60 69" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M60 77 L51 66" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M45 69 L51 54" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M45 51 L60 51" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />

          {/* Center Focal Core */}
          <circle cx="60" cy="60" r="3.5" fill="#E5C158" />
        </svg>
      </div>

      {/* ── Wordmark ── */}
      {showText && (
        <div className="flex flex-col text-left">
          <span
            className={`font-bold uppercase text-foreground font-oswald leading-none ${fontSizes[textSize]}`}
          >
            Frameshare
          </span>
          <span
            className={`font-semibold uppercase text-amber-500/90 dark:text-amber-400/90 font-mono mt-0.5 leading-none ${subFontSizes[textSize]}`}
          >
            Studio Platform
          </span>
        </div>
      )}
    </div>
  )
}

