"use server"

import { db } from "@/db"
import { users } from "@/db/schema"
import { auth } from "@/auth"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { uploadBuffer } from "@/lib/s3"
import { requireAuth } from "@/lib/require-auth"

export async function updateAccount(formData: FormData) {
  const userId = await requireAuth()

  const name = (formData.get("name") as string).trim()
  const accentColor = formData.get("accentColor") as string | null

  await db.update(users).set({
    name: name || undefined,
    accentColor: accentColor || null,
  }).where(eq(users.id, userId))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
}

export async function uploadAccountLogo(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const file = formData.get("logo") as File | null
  if (!file || file.size === 0) return { error: "No file selected" }
  if (file.size > 5 * 1024 * 1024) return { error: "Logo must be under 5 MB" }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const key = `logos/${session.user.id}/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadBuffer(key, buffer, file.type)

  await db.update(users).set({ logoKey: key }).where(eq(users.id, session.user.id))
  revalidatePath("/dashboard/settings")
}
