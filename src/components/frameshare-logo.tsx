import React from "react"

interface FrameshareLogoProps {
  className?: string
  iconSize?: number
  showText?: boolean
  textSize?: "sm" | "md" | "lg"
}

export function FrameshareLogo({
  className = "",
  iconSize = 32,
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
      {/* ── Frameshare Icon Mark ── */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl bg-white text-black shadow-lg overflow-hidden group-hover:scale-105 transition-transform duration-300"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Outer Viewfinder Frame */}
          <rect
            x="4"
            y="4"
            width="28"
            height="28"
            rx="5"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          {/* Inner Overlapping Photo Frame */}
          <rect
            x="10"
            y="10"
            width="16"
            height="16"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          {/* Center Aperture Focus Dot */}
          <circle cx="18" cy="18" r="2.2" fill="currentColor" />
          {/* Precision Corner Marks */}
          <path d="M7 11V7H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M25 7H29V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M29 25V29H25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 29H7V25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* ── Wordmark ── */}
      {showText && (
        <div className="flex flex-col text-left">
          <span
            className={`font-bold uppercase text-white font-oswald leading-none ${fontSizes[textSize]}`}
          >
            Frameshare
          </span>
          <span
            className={`font-semibold uppercase text-white/50 font-mono mt-0.5 leading-none ${subFontSizes[textSize]}`}
          >
            Studio Platform
          </span>
        </div>
      )}
    </div>
  )
}
