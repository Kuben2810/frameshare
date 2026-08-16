"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
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
  Zap,
  ShieldCheck,
  HardDrive,
  Layers,
  Flame,
} from "lucide-react"
import { ScrollExpandMedia } from "@/components/ui/scroll-expansion-hero"
import { FrameshareLogo } from "@/components/frameshare-logo"
import { AnimatedLaunchButton } from "@/components/ui/animated-launch-button"
import { SpotlightCard } from "@/components/ui/spotlight-card"

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
            <FrameshareLogo iconHeight={36} textSize="md" />
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
              <AnimatedLaunchButton href="/dashboard" size="sm" variant="primary">
                Studio Dashboard
              </AnimatedLaunchButton>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <AnimatedLaunchButton href="/register" size="sm" variant="primary">
                  Launch Studio
                </AnimatedLaunchButton>
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
              <AnimatedLaunchButton href="/register" size="lg" variant="primary">
                Launch Your Studio Free
              </AnimatedLaunchButton>
              <button
                onClick={() => scrollToSection("features")}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-sm uppercase tracking-wider transition-all text-center cursor-pointer font-oswald shadow-lg hover:border-white/40 active:scale-[0.98]"
              >
                Explore Features
              </button>
            </div>
          </div>

          {/* ── Feature Highlights Grid (21st.dev Spotlight & Staggered Motion) ── */}
          <div id="features" className="space-y-12 pt-8 scroll-mt-28">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                <Zap className="h-3 w-3 animate-bounce" />
                <span>Engineered for Darkroom Speed</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-wide text-white">
                Everything You Need to Impress Clients
              </h2>
              <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto font-light">
                Every micro-interaction is tuned for maximum luxury, high performance, and effortless client selections.
              </p>
            </div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.1 },
                },
              }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {/* Card 1: Streaming ZIP */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <Download className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      Zero Lag
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Streaming ZIP Bulk Downloads
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    No server memory bottlenecks or ZIP build delays. Clients download 500+ full-resolution photos in a single direct-stream cloud archive.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Card 2: Mobile Touch Gestures */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      60 FPS
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Mobile Touch Gestures
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    Native swipe navigation in the lightbox. Swipe left/right to browse, swipe down to dismiss, and double-tap to zoom into high-res details.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Card 3: Instant Email Alerts */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <Mail className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      Real-Time
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Instant Darkroom Alerts
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    The second your client finalizes their starred proofing selection, you receive a formatted darkroom notification with one-click studio access.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Card 4: Zero-Friction Starring */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <Heart className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      Zero Sign-Up
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Zero-Friction Starring
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    Clients never need to create accounts or remember passwords. Starring and commenting are automatically saved to their active session.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Card 5: Secure Password Gating */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <Lock className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      AES-256
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Secure Password Gating
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    Protect private wedding or boudoir galleries with encrypted password gates, custom slug handles, and automatic gallery expiration timers.
                  </p>
                </SpotlightCard>
              </motion.div>

              {/* Card 6: Editorial Lightbox Tools */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 24 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                }}
              >
                <SpotlightCard className="h-full space-y-4 hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="flex items-center justify-between gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-amber-500/15 group-hover:border-amber-400/40 group-hover:text-amber-400 transition-all duration-300">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 group-hover:border-amber-400/30 group-hover:text-amber-300 transition-colors">
                      Darkroom Pro
                    </span>
                  </div>
                  <h3 className="text-xl font-bold font-oswald uppercase tracking-wider text-white group-hover:text-amber-100 transition-colors">
                    Editorial Lightbox Tools
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed font-light">
                    Built-in analog film presets, before/after compare slider, crop export tool, and per-photo client comment threads right inside the viewer.
                  </p>
                </SpotlightCard>
              </motion.div>
            </motion.div>
          </div>

          {/* ── Workflow Diagram (Animated Connecting Laser Timeline) ── */}
          <div id="workflow" className="rounded-3xl bg-neutral-950 border border-white/15 p-8 sm:p-12 space-y-12 scroll-mt-28 relative overflow-hidden shadow-2xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="text-center space-y-2 relative z-10">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400 font-mono">
                Simple 3-Step Process
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold font-oswald uppercase tracking-wide text-white">
                How Frameshare Transforms Delivery
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative z-10">
              {/* Connecting Laser Beam on Desktop */}
              <div className="hidden md:block absolute top-7 left-[18%] right-[18%] h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-400 to-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.5)] pointer-events-none" />

              {/* Step 1 */}
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 text-center sm:text-left bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm group hover:border-amber-400/40 hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="relative inline-flex items-center justify-center h-12 w-12 rounded-full bg-neutral-900 border-2 border-amber-400 text-amber-300 font-bold font-mono text-base shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all duration-300">
                  01
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white group-hover:text-amber-300 transition-colors">
                  Upload in Seconds
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-light">
                  Drag and drop full-resolution photos or watermarked sets. High-speed multi-threaded Sharp processing handles thumbnail generation in real time.
                </p>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 text-center sm:text-left bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm group hover:border-amber-400/40 hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="relative inline-flex items-center justify-center h-12 w-12 rounded-full bg-neutral-900 border-2 border-amber-400 text-amber-300 font-bold font-mono text-base shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all duration-300">
                  02
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white group-hover:text-amber-300 transition-colors">
                  Share Custom Link
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-light">
                  Send your vanity URL (e.g. <code>frameshare.app/g/smith-wedding</code>). Clients browse in stunning masonry or horizontal ribbon layouts on any screen.
                </p>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 text-center sm:text-left bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm group hover:border-amber-400/40 hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="relative inline-flex items-center justify-center h-12 w-12 rounded-full bg-neutral-900 border-2 border-amber-400 text-amber-300 font-bold font-mono text-base shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-black transition-all duration-300">
                  03
                </div>
                <h4 className="text-xl font-bold font-oswald uppercase text-white group-hover:text-amber-300 transition-colors">
                  Receive Curated Proofs
                </h4>
                <p className="text-sm text-white/60 leading-relaxed font-light">
                  Review submitted selections in your studio dashboard, download client-starred ZIP archives, or export Lightroom-ready selection filenames.
                </p>
              </motion.div>
            </div>
          </div>

          {/* ── Cloud Economics & Zero Markup (21st.dev Border Beam & Comparison) ── */}
          <div id="economics" className="space-y-8 scroll-mt-28">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400 font-mono">
                Fair & Open Economics
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-wide text-white">
                Stop Overpaying for Cloud Storage
              </h2>
              <p className="text-sm sm:text-base text-white/60 max-w-2xl mx-auto font-light">
                Traditional gallery platforms charge 10x-20x storage markups and restrict your downloads. Frameshare connects directly to S3 / Cloudflare R2.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
              {/* Legacy Platforms */}
              <div className="rounded-3xl bg-neutral-950/80 border border-white/10 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs uppercase font-mono tracking-widest text-red-400 font-bold">Legacy Platforms</span>
                    <h3 className="text-2xl font-bold font-oswald uppercase text-white/80">Pixieset / Pic-Time</h3>
                  </div>
                  <ul className="space-y-3.5 text-sm text-white/70">
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-400 font-bold text-base leading-none">✕</span>
                      <span>$30 – $50/month recurring subscription fees</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-400 font-bold text-base leading-none">✕</span>
                      <span>Expensive per-GB tier penalties as catalog grows</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-red-400 font-bold text-base leading-none">✕</span>
                      <span>Your photo library is locked inside a proprietary walled garden</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-4 border-t border-white/10 text-xs font-mono text-white/40">
                  Cost over 3 years: <span className="text-red-400 font-bold">$1,200 – $1,800+</span>
                </div>
              </div>

              {/* The Frameshare Way (with 21st.dev Rotating Border Beam) */}
              <div className="relative p-[1.5px] rounded-3xl overflow-hidden group shadow-2xl">
                {/* Rotating Conic Border Beam */}
                <div
                  className="absolute inset-[-100%] animate-[spin_5s_linear_infinite]"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, transparent 60deg, #10B981 120deg, #34D399 180deg, #10B981 240deg, transparent 300deg, transparent 360deg)",
                  }}
                />

                {/* Inner Card Core */}
                <div className="relative h-full rounded-3xl bg-neutral-900 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-xs uppercase font-mono tracking-widest text-emerald-400 font-bold">The Frameshare Way</span>
                        <h3 className="text-2xl font-bold font-oswald uppercase text-white">Direct S3 / Cloudflare R2</h3>
                      </div>
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase px-3 py-1 rounded-full border border-emerald-500/40 font-mono shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>Recommended</span>
                      </div>
                    </div>

                    <ul className="space-y-3.5 text-sm text-white font-medium">
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>10 GB Free Storage</strong> on Cloudflare R2 forever</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>$0 Egress Bandwidth</strong> — unlimited client downloads</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span><strong>You Own Your Data</strong> directly in your own cloud bucket</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-emerald-500/20 text-xs font-mono text-emerald-400/90 flex items-center justify-between">
                    <span>Average Savings:</span>
                    <span className="font-bold text-emerald-400 text-sm">$360 – $600 / year</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── FAQ Section (Smooth Animated Accordion) ── */}
          <div id="faq" className="space-y-8 max-w-3xl mx-auto scroll-mt-28">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 font-mono">
                Questions & Answers
              </span>
              <h2 className="text-3xl font-bold font-oswald uppercase text-white">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3.5">
              {faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx
                return (
                  <motion.div
                    key={idx}
                    initial={false}
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? "border-amber-400/40 bg-neutral-900/90 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                        : "border-white/10 bg-neutral-950/70 hover:border-white/20"
                    }`}
                  >
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left font-semibold text-sm sm:text-base text-white/90 hover:text-white cursor-pointer"
                    >
                      <span className="pr-4">{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 ease-out ${
                          isOpen ? "rotate-180 text-amber-400" : ""
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-5 text-sm text-white/70 leading-relaxed border-t border-white/5 pt-3.5 font-light">
                            {faq.a}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </div>


          {/* ── Bottom Call to Action Banner ── */}
          <div className="rounded-3xl bg-neutral-900 border border-white/15 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Ambient gold spotlight */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-oswald uppercase tracking-tight text-white">
                Ready to Upgrade Your Photography Delivery?
              </h2>
              <p className="text-base sm:text-lg text-white/70 max-w-xl mx-auto font-light">
                Create client collections, deliver high-res photo albums, and streamline selections in minutes.
              </p>
              <div className="pt-4 flex justify-center">
                <AnimatedLaunchButton href="/register" size="lg" variant="primary">
                  Launch Your Studio Now
                </AnimatedLaunchButton>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <footer className="pt-12 pb-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40 font-mono">
            <div className="flex items-center gap-3">
              <FrameshareLogo iconHeight={26} textSize="sm" />
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
