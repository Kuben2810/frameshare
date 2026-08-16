"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnimatedLaunchButtonProps {
  href?: string
  onClick?: () => void
  children?: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "dark" | "ghost"
  showAperture?: boolean
  pulseAura?: boolean
}

export function AnimatedLaunchButton({
  href,
  onClick,
  children,
  className = "",
  size = "lg",
  variant = "primary",
  showAperture = true,
  pulseAura = true,
}: AnimatedLaunchButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-xs gap-2 rounded-xl",
    md: "px-6 py-3 text-xs sm:text-sm gap-2.5 rounded-xl",
    lg: "px-8 py-4 text-sm sm:text-base gap-3 rounded-2xl",
  }

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const arrowSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  const content = (
    <div className={cn("relative group inline-flex items-center justify-center select-none cursor-pointer", className)}>
      {/* ── 1. Ambient Radial Spotlight Glow Aura ── */}
      {pulseAura && (
        <div
          className={cn(
            "absolute -inset-1.5 rounded-2xl opacity-60 blur-xl transition-all duration-700 pointer-events-none group-hover:opacity-100 group-hover:scale-105",
            variant === "primary"
              ? "bg-gradient-to-r from-amber-500/50 via-amber-300/40 to-amber-600/50 animate-pulse"
              : variant === "dark"
              ? "bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-amber-600/40 animate-pulse"
              : "bg-white/20 blur-lg"
          )}
        />
      )}

      {/* ── 2. Rotating Border Beam Container ── */}
      <div className="relative p-[1.5px] overflow-hidden rounded-2xl w-full">
        {/* Animated Conic Gradient Border Ray (21st.dev Border Beam) */}
        <div
          className="absolute inset-[-100%] animate-[spin_4s_linear_infinite] opacity-80 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background:
              variant === "primary"
                ? "conic-gradient(from 0deg, transparent 0deg, transparent 60deg, #F59E0B 120deg, #FFFFFF 180deg, #F59E0B 240deg, transparent 300deg, transparent 360deg)"
                : "conic-gradient(from 0deg, transparent 0deg, transparent 60deg, #F59E0B 140deg, #FBBF24 180deg, #F59E0B 220deg, transparent 300deg, transparent 360deg)",
          }}
        />

        {/* ── 3. Main Button Core Surface ── */}
        <div
          className={cn(
            "relative flex items-center justify-center font-oswald font-bold uppercase tracking-wider transition-all duration-300 overflow-hidden active:scale-[0.98]",
            sizeClasses[size],
            variant === "primary"
              ? "bg-white text-neutral-950 shadow-2xl hover:bg-neutral-50"
              : variant === "dark"
              ? "bg-neutral-950/95 text-white border border-white/10 hover:bg-neutral-900 shadow-xl backdrop-blur-xl"
              : "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-md"
          )}
        >
          {/* Shimmer Sheen Sweep (Light Ray on Hover & Periodic Sweep) */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

          {/* Miniature Animated Aperture Shutter Icon Mark */}
          {showAperture && (
            <div className="relative shrink-0 flex items-center justify-center transition-transform duration-700 ease-out group-hover:rotate-180 group-hover:scale-110">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(iconSizes[size], "shrink-0 drop-shadow-xs")}
              >
                {/* Outer Ring */}
                <circle cx="18" cy="18" r="15" stroke={variant === "primary" ? "#F59E0B" : "#FBBF24"} strokeWidth="2.5" />
                {/* 6 Angled Aperture Shutter Blades */}
                <path d="M18 5 L24 14" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M29 11 L24 23" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M29 23 L18 23" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M18 31 L12 23" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 23 L12 14" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7 11 L18 11" stroke={variant === "primary" ? "#D97706" : "#F59E0B"} strokeWidth="1.8" strokeLinecap="round" />
                {/* Center Core */}
                <circle cx="18" cy="18" r="3" fill={variant === "primary" ? "#F59E0B" : "#FBBF24"} />
              </svg>
            </div>
          )}

          {/* Label Text */}
          <span className="relative z-10 font-bold tracking-[0.08em] whitespace-nowrap">
            {children ?? "Launch Your Studio"}
          </span>

          {/* Animated Sliding Action Arrow */}
          <div className="relative z-10 transition-transform duration-300 ease-out group-hover:translate-x-1.5">
            <ArrowRight
              className={cn(
                arrowSizes[size],
                variant === "primary" ? "text-amber-600" : "text-amber-400"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className="inline-block border-0 bg-transparent p-0">
      {content}
    </button>
  )
}
