"use client"

import { useState } from "react"
import { getClientId } from "./use-client-identity"

export function useSelection(slug: string) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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

  return { submitting, submitted, submitSelection }
}
