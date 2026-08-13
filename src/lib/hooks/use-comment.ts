"use client"

import { useState } from "react"
import type { InferSelectModel } from "drizzle-orm"
import type { comments } from "@/db/schema"

type Comment = InferSelectModel<typeof comments>

export function useComment(slug: string, initialComments: Comment[]) {
  const [commentMap, setCommentMap] = useState<Record<string, Comment[]>>(
    () => initialComments.reduce<Record<string, Comment[]>>((acc, c) => {
      acc[c.photoId] = [...(acc[c.photoId] ?? []), c]
      return acc
    }, {})
  )

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

  return { commentMap, submitComment }
}
