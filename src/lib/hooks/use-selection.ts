"use client"

import { useState } from "react"
import { getClientId } from "./use-client-identity"

export function useSelection(slug: string) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submitSelection() {
    setSubmitting(true)
    const clientId = getClientId()
    try {
      const res = await fetch(`/api/galleries/${slug}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })
      if (res.ok) setSubmitted(true)
      return res.ok
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, submitted, submitSelection }
}
