"use client"

import { X, MapPin, Mail, Share2, Globe, AtSign } from "lucide-react"
import type { InferSelectModel } from "drizzle-orm"
import type { galleries } from "@/db/schema"

type Gallery = InferSelectModel<typeof galleries>

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
