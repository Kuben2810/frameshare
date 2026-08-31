"use server"

import { db } from "@/db"
import { galleries, workspaces } from "@/db/schema"
import { uploadBuffer } from "@/lib/s3"
import { requireAuth } from "@/lib/require-auth"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12)
}

export type OnboardingState = { error?: string }

function supportedLogoExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase()
  return extension && ["png", "jpg", "jpeg", "webp", "svg"].includes(extension) ? extension : null
}

export async function completeOnboarding(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const userId = await requireAuth()
  const { workspace } = await ensureActiveWorkspace(userId)

  const workspaceName = String(formData.get("workspaceName") ?? "").trim()
  const galleryName = String(formData.get("galleryName") ?? "").trim()
  const accentColor = String(formData.get("accentColor") ?? "").trim()

  if (!workspaceName) return { error: "Your studio name is required" }
  if (!galleryName) return { error: "Your first gallery needs a name" }
  if (workspaceName.length > 120 || galleryName.length > 160) return { error: "Please use a shorter name" }
  if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) return { error: "Choose a valid accent colour" }

  let logoKey = workspace.logoKey
  const logo = formData.get("logo")
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 5 * 1024 * 1024) return { error: "Logo must be under 5 MB" }
    const extension = supportedLogoExtension(logo)
    if (!extension) return { error: "Logo must be a PNG, JPEG, WebP, or SVG file" }

    logoKey = `logos/${workspace.id}/logo.${extension}`
    await uploadBuffer(logoKey, Buffer.from(await logo.arrayBuffer()), logo.type)
  }

  const galleryId = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.update(workspaces).set({
      name: workspaceName,
      accentColor: accentColor || null,
      logoKey,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workspaces.id, workspace.id))

    await tx.insert(galleries).values({
      id: galleryId,
      userId,
      workspaceId: workspace.id,
      name: galleryName,
      slug: randomSlug(),
      stage: "proofing",
      downloadMode: "none",
    })
  })

  redirect(`/dashboard/galleries/${galleryId}?tab=photos&onboarding=complete`)
}
