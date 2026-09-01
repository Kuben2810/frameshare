"use server"

import { db } from "@/db"
import { workspaces } from "@/db/schema"
import { auth } from "@/auth"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { uploadBuffer } from "@/lib/s3"
import { requireAuth } from "@/lib/require-auth"
import { ensureActiveWorkspace } from "@/lib/workspace"

export async function updateAccount(formData: FormData) {
  const userId = await requireAuth()
  const { workspace } = await ensureActiveWorkspace(userId)

  const name = (formData.get("name") as string).trim()
  const accentColor = formData.get("accentColor") as string | null

  await db.update(workspaces).set({
    name: name || workspace.name,
    accentColor: accentColor || null,
    updatedAt: new Date(),
  }).where(eq(workspaces.id, workspace.id))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
}

export async function uploadAccountLogo(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { workspace } = await ensureActiveWorkspace(session.user.id)

  const file = formData.get("logo") as File | null
  if (!file || file.size === 0) return { error: "No file selected" }
  if (file.size > 5 * 1024 * 1024) return { error: "Logo must be under 5 MB" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const key = `logos/${workspace.id}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadBuffer(key, buffer, file.type)

  await db.update(workspaces).set({ logoKey: key, updatedAt: new Date() }).where(eq(workspaces.id, workspace.id))
  revalidatePath("/dashboard/settings")
}
