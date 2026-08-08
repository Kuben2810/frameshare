"use server"

import { db } from "@/db"
import { users } from "@/db/schema"
import { auth } from "@/auth"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { s3, BUCKET } from "@/lib/s3"

export async function updateAccount(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const name = (formData.get("name") as string).trim()
  const accentColor = formData.get("accentColor") as string | null

  await db.update(users).set({
    name: name || undefined,
    accentColor: accentColor || null,
  }).where(eq(users.id, session.user.id))

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

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  await db.update(users).set({ logoKey: key }).where(eq(users.id, session.user.id))
  revalidatePath("/dashboard/settings")
}
