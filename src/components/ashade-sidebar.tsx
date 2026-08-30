"use client"

import { X, MapPin, Mail, Share2, Globe, AtSign } from "lucide-react"
import type { PublicGallery } from "@/lib/public-gallery"

type Gallery = PublicGallery

function imgUrl(key: string | null | undefined) {
  if (!key) return null
  return `/api/s3/${key}`
}

export function AshadeSidebar({
  isOpen,
  onClose,
  gallery,
  starredCount,
  totalCount,
  submitted,
  submitting,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  gallery: Gallery
  starredCount: number
  totalCount: number
  submitted: boolean
  submitting: boolean
  onSubmit: () => void
}) {
  return (
    <>
      <div
        className={`ashade-aside-overlay ${isOpen ? "is-visible" : ""}`}
        onClick={onClose}
        data-cursor="close"
      />
      <aside className={`ashade-aside ${isOpen ? "is-open" : ""}`}>
        <button className="ashade-aside-close" onClick={onClose} data-cursor="close">
          <X size={18} />
          <span>Close</span>
        </button>

        <div className="ashade-aside-inner">
          {/* Gallery Branding */}
          <div className="ashade-widget">
            {gallery.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl(gallery.logoKey)!} alt="" className="ashade-aside-logo" />
            )}
            <h5 style={{ fontFamily: "var(--font-oswald, 'Oswald', sans-serif)", letterSpacing: "0.08em" }}>
              <span>Gallery</span>
              {gallery.name}
            </h5>
          </div>

          {/* Photo Stats */}
          <div className="ashade-widget">
            <h5 className="ashade-widget-title">
              <span>Gallery Info</span>
              Your Selection
            </h5>
            <ul className="ashade-contact-details__list">
              <li>
                <span className="info-icon-dot" />
                <span>{totalCount} photos in this gallery</span>
              </li>
              <li>
                <span className="info-icon-dot" />
                <span>{starredCount} photo{starredCount !== 1 ? "s" : ""} starred</span>
              </li>
              {gallery.downloadMode !== "none" && (
                <li>
                  <span className="info-icon-dot" />
                  <span>Downloads {gallery.downloadMode === "lowres" ? "watermarked" : "enabled"}</span>
                </li>
              )}
            </ul>

            {starredCount > 0 && !submitted && (
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="ashade-submit-btn"
                data-cursor="link"
              >
                {submitting ? "Submitting…" : `Submit ${starredCount} selection${starredCount !== 1 ? "s" : ""}`}
              </button>
            )}
            {submitted && (
              <p style={{ color: "#4cd964", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em" }}>
                ✓ Selection submitted
              </p>
            )}

            {/* Bulk Downloads */}
            {gallery.downloadMode !== "none" && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <a
                  href={`/api/galleries/${gallery.slug}/download?type=all`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider transition-colors"
                  data-cursor="link"
                  download
                >
                  <span>Download Collection (.ZIP)</span>
                </a>
                {starredCount > 0 && (
                  <a
                    href={`/api/galleries/${gallery.slug}/download?type=starred&clientId=${typeof window !== "undefined" ? localStorage.getItem(`frameshare_client_id_${gallery.slug}`) || localStorage.getItem("frameshare_client_id") || "" : ""}`}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/15 text-white/80 text-[11px] font-medium tracking-wider transition-colors"
                    data-cursor="link"
                    download
                  >
                    <span>Download Starred ({starredCount}) (.ZIP)</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Contact placeholder */}
          <div className="ashade-widget">
            <h5 className="ashade-widget-title">
              <span>Need Help?</span>
              Contact Photographer
            </h5>
            <ul className="ashade-contact-details__list">
              <li>
                <Mail size={14} className="icon" />
                <span>Reply to the gallery invitation email</span>
              </li>
            </ul>
            <div className="ashade-socials">
              <a href="#" className="social-link" data-cursor="link" title="Portfolio"><Globe size={14} /></a>
              <a href="#" className="social-link" data-cursor="link" title="Social"><AtSign size={14} /></a>
              <a href="#" className="social-link" data-cursor="link" title="Share"><Share2 size={14} /></a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
