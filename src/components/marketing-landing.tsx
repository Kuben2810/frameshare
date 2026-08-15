"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Download,
  Sparkles,
  Smartphone,
  Mail,
  ArrowRight,
  CheckCircle2,
  Lock,
  ChevronDown,
  Heart,
  SlidersHorizontal,
} from "lucide-react"
import { ScrollExpandMedia } from "@/components/ui/scroll-expansion-hero"
import { FrameshareLogo } from "@/components/frameshare-logo"

interface MarketingLandingProps {
  userSession?: {
    name?: string | null
    email?: string | null
  } | null
}

const mediaContent = {
  src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1600&auto=format&fit=crop",
  background: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1920&auto=format&fit=crop",
  title: "FRAMESHARE STUDIO",
  date: "HIGH-IMPACT CLIENT PROOFING",
  scrollToExpand: "SCROLL TO EXPLORE THE PLATFORM",
}

export function MarketingLanding({ userSession }: MarketingLandingProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  function scrollToSection(id: string) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("expandHero", { detail: { targetId: id } }))
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  const faqs = [
    {
      q: "How does client proofing and selection work?",
      a: "Clients simply open your custom gallery link. With zero sign-up or friction, they tap the star icon on their favorite photos. Once finished, they click 'Submit Selection' and you receive an instant luxury email notification with their curated picks.",
    },
    {
      q: "Can clients download individual photos or full collections as a ZIP?",
      a: "Yes! Frameshare features a high-speed streaming ZIP downloader. Clients or photographers can download entire collections (or just the client's starred selections) in a single fast stream directly from S3 storage.",
    },
    {
      q: "Does Frameshare charge extra for storage or bandwidth?",
      a: "No! Frameshare connects directly to your own storage (such as Cloudflare R2, which offers 10GB free and $0 egress bandwidth fees). You never pay predatory storage markups or per-gallery delivery fees.",
    },
    {
      q: "Can I password protect client galleries?",
      a: "Yes. Every gallery supports password protection with secure HTTP-only cookies, customizable expiration dates, and configurable download resolutions (full-res, watermarked, or view-only).",
    },
    {
      q: "Is Frameshare optimized for mobile phones?",
      a: "Extremely. Frameshare's lightbox includes native touch gestures (swipe left/right for next/previous photo, swipe down to dismiss, double-tap zoom) and responsive layouts crafted specifically for smartphone portrait screens.",
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20 font-sans">
      {/* ── Floating Luxury Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-black/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Bespoke Frameshare Logo */}
          <Link href="/" className="group flex items-center">
            <FrameshareLogo iconSize={36} textSize="md" />
          </Link>

          {/* Desktop Nav Links (Interactive Anchor Jumpers) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-white/60">
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("workflow")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Workflow
            </button>
            <button
              onClick={() => scrollToSection("economics")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Economics
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="hover:text-white transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            {userSession ? (
              <Link
                href="/dashboard"
                className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-all shadow-lg flex items-center gap-1.5"
              >
                <span>Studio Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-all shadow-lg flex items-center gap-1.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Scroll Expand Hero Section ── */}
      <ScrollExpandMedia
        mediaType="image"
        mediaSrc={mediaContent.src}
        bgImageSrc={mediaContent.background}
        title={mediaContent.title}
        date={mediaContent.date}
        scrollToExpand={mediaContent.scrollToExpand}
      >
        {/* ── Expanded Content (Floats in on scroll) ── */}
        <div className="max-w-6xl mx-auto w-full space-y-24 pt-8">

          {/* ── Hero Tagline & Stats Ribbon ── */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold uppercase tracking-widest text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Next-Generation Photography Client Delivery</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-oswald uppercase tracking-tight text-white max-w-4xl mx-auto leading-[1.05]">
              Deliver Proofs Faster. Delight Clients. Keep 100% of Your Margins.
            </h1>

            <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto font-light leading-relaxed">
              Frameshare is the modern proofing and high-res delivery platform built for wedding, portrait, and editorial photographers. Zero client sign-ups, instant streaming ZIPs, and luxury darkroom presentation.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-white/90 transition-all shadow-2xl flex items-center justify-center gap-2"
              >
                <span>Launch Your Studio Free</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => scrollToSection("features")}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-sm uppercase tracking-wider transition-all text-center cursor-pointer"
              >
                Explore Features
              </button>
            </div>
          </div>

          {/* ── Feature Highlights Grid ── */}
          <div id="features" className="space-y-12 pt-8 scroll-mt-28">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 font-mono">
                Architected for Excellence
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-wide text-white">
                Everything You Need to Impress Clients
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Download className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Streaming ZIP Bulk Downloads
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  No zip compilation lag or memory limits. Clients can download 500+ photos in a single high-speed stream directly from cloud storage.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Mobile Touch Gestures
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Native swipe navigation in the lightbox. Swipe left/right to browse, swipe down to dismiss, and double-tap to zoom into high-res details.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Instant Email Alerts
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  The second your client finalizes their starred proofing selection, you receive a formatted darkroom notification with one-click studio access.
                </p>
              </div>

              {/* Card 4 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Zero-Friction Starring
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Clients don&apos;t need to register an account or remember passwords. Starring is instantly saved to their device session with multi-device support.
                </p>
              </div>

              {/* Card 5 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Secure Password Gating
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Protect private wedding or boudoir galleries with encrypted password gates, custom slug handles, and automatic gallery expiration timers.
                </p>
              </div>

              {/* Card 6 */}
              <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-6 sm:p-8 space-y-4 hover:border-white/25 transition-all">
                <div className="h-12 w-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white">
                  Editorial Lightbox Tools
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Built-in film presets, before/after compare slider, crop export tool, and per-photo client comment threads right inside the viewer.
                </p>
              </div>
            </div>
          </div>

          {/* ── Workflow Diagram ── */}
          <div id="workflow" className="rounded-3xl bg-neutral-950 border border-white/15 p-8 sm:p-12 space-y-12 scroll-mt-28">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 font-mono">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-oswald uppercase tracking-wide text-white">
                How Frameshare Transforms Delivery
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-black font-bold font-mono text-sm">
                  01
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white">Upload in Seconds</h4>
                <p className="text-sm text-white/60 leading-relaxed">
                  Drag and drop full-resolution photos or watermarked sets. High-speed multi-threaded Sharp processing handles thumbnail generation in real time.
                </p>
              </div>

              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-black font-bold font-mono text-sm">
                  02
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white">Share Custom Link</h4>
                <p className="text-sm text-white/60 leading-relaxed">
                  Send your vanity URL (e.g. <code>frameshare.app/g/smith-wedding</code>). Clients browse in stunning masonry or horizontal ribbon layouts on any screen.
                </p>
              </div>

              <div className="space-y-4 text-center sm:text-left">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-black font-bold font-mono text-sm">
                  03
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white">Receive Curated Proofs</h4>
                <p className="text-sm text-white/60 leading-relaxed">
                  Review submitted selections in your studio dashboard, download client-starred ZIP archives, or export Lightroom-ready selection filenames.
                </p>
              </div>
            </div>
          </div>

          {/* ── Cloud Economics & Zero Markup ── */}
          <div id="economics" className="space-y-8 scroll-mt-28">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400 font-mono">
                Fair & Open Economics
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-wide text-white">
                Stop Overpaying for Cloud Storage
              </h2>
              <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto">
                Traditional gallery platforms charge 10x-20x storage markups and restrict your downloads. Frameshare connects directly to S3 / Cloudflare R2.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="rounded-2xl bg-neutral-900/50 border border-white/10 p-6 sm:p-8 space-y-6">
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-red-400">Legacy Platforms</span>
                  <h3 className="text-2xl font-bold font-oswald uppercase text-white">Pixieset / Pic-Time</h3>
                </div>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">✕</span>
                    <span>$30 – $50/month subscription fees</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">✕</span>
                    <span>Expensive per-GB storage tiers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">✕</span>
                    <span>Storage tied to a locked proprietary platform</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/25 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-emerald-500/30 font-mono">
                  Recommended
                </div>
                <div className="space-y-2">
                  <span className="text-xs uppercase font-mono tracking-widest text-emerald-400">The Frameshare Way</span>
                  <h3 className="text-2xl font-bold font-oswald uppercase text-white">Direct S3 / Cloudflare R2</h3>
                </div>
                <ul className="space-y-3 text-sm text-white">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>10 GB Free Storage</strong> on Cloudflare R2 forever</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>$0 Egress Bandwidth</strong> — unlimited client downloads</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>You Own Your Data</strong> directly in your own cloud bucket</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── FAQ Section ── */}
          <div id="faq" className="space-y-8 max-w-3xl mx-auto scroll-mt-28">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 font-mono">
                Questions & Answers
              </span>
              <h2 className="text-3xl font-bold font-oswald uppercase text-white">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-neutral-950/70 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full px-6 py-4.5 flex items-center justify-between text-left font-semibold text-sm sm:text-base hover:text-white text-white/90 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${
                        activeFaq === idx ? "rotate-180 text-white" : ""
                      }`}
                    />
                  </button>
                  {activeFaq === idx && (
                    <div className="px-6 pb-5 text-sm text-white/60 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom Call to Action Banner ── */}
          <div className="rounded-3xl bg-white text-black p-8 sm:p-14 text-center space-y-6 shadow-2xl">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-tight">
              Ready to Upgrade Your Photography Delivery?
            </h2>
            <p className="text-base sm:text-lg text-neutral-700 max-w-xl mx-auto font-medium">
              Create client collections, deliver high-res photo albums, and streamline selections in minutes.
            </p>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-black text-white font-bold text-sm uppercase tracking-wider hover:bg-neutral-800 transition-all shadow-xl"
              >
                <span>Launch Your Studio Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="pt-12 pb-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40 font-mono">
            <div className="flex items-center gap-3">
              <FrameshareLogo iconSize={24} textSize="sm" />
            </div>
            <div className="flex items-center gap-6">
              <Link href="/login" className="hover:text-white transition-colors">Studio Login</Link>
              <Link href="/register" className="hover:text-white transition-colors">Register</Link>
              <button onClick={() => scrollToSection("features")} className="hover:text-white transition-colors cursor-pointer">
                Features
              </button>
            </div>
          </footer>

        </div>
      </ScrollExpandMedia>
    </div>
  )
}
