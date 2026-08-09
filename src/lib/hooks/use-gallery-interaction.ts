"use client"

import { useState } from "react"
import type { InferSelectModel } from "drizzle-orm"
import type { stars, comments } from "@/db/schema"
import { getClientId } from "./use-client-identity"

type Star = InferSelectModel<typeof stars>
type Comment = InferSelectModel<typeof comments>

export function useGalleryInteraction(
  slug: string,
  initialStars: Star[],
  initialComments: Comment[],
) {
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(initialStars.map((s) => s.photoId))
  )
  const [commentMap, setCommentMap] = useState<Record<string, Comment[]>>(
    () => initialComments.reduce<Record<string, Comment[]>>((acc, c) => {
      acc[c.photoId] = [...(acc[c.photoId] ?? []), c]
      return acc
    }, {})
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function toggleStar(photoId: string) {
    const clientId = getClientId()
    const isStarred = starredIds.has(photoId)
    setStarredIds((s) => { const n = new Set(s); isStarred ? n.delete(photoId) : n.add(photoId); return n })
    await fetch(`/api/galleries/${slug}/stars`, {
      method: isStarred ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, clientId }),
    })
  }

  async function submitComment(photoId: string, body: string, authorName: string) {
    if (!body.trim()) return
    const res = await fetch(`/api/galleries/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, body, authorName }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      setCommentMap((m) => ({ ...m, [photoId]: [...(m[photoId] ?? []), comment] }))
      return true
    }
    return false
  }

  async function submitSelection() {
    setSubmitting(true)
    const clientId = getClientId()
    await fetch(`/api/galleries/${slug}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  return { starredIds, commentMap, submitting, submitted, toggleStar, submitComment, submitSelection }
}
