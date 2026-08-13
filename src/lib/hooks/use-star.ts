"use client"

import { useState, useEffect } from "react"
import type { InferSelectModel } from "drizzle-orm"
import type { stars } from "@/db/schema"
import { getClientId } from "./use-client-identity"

type Star = InferSelectModel<typeof stars>

export function useStar(slug: string, initialStars: Star[]) {
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    const clientId = getClientId()
    if (!clientId) return new Set()
    return new Set(initialStars.filter((s) => s.clientId === clientId).map((s) => s.photoId))
  })

  useEffect(() => {
    const clientId = getClientId()
    if (clientId) {
      setStarredIds(new Set(initialStars.filter((s) => s.clientId === clientId).map((s) => s.photoId)))
    }
  }, [initialStars])

  async function toggleStar(photoId: string) {
    const clientId = getClientId()
    if (!clientId) return
    const isStarred = starredIds.has(photoId)
    setStarredIds((s) => {
      const n = new Set(s)
      if (isStarred) n.delete(photoId)
      else n.add(photoId)
      return n
    })
    await fetch(`/api/galleries/${slug}/stars`, {
      method: isStarred ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, clientId }),
    })
  }

  return { starredIds, toggleStar }
}
