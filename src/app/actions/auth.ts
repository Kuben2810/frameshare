"use server"

import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { signIn } from "@/auth"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

export async function register(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const name = formData.get("name") as string

  if (!email || !password || !name) return { error: "All fields required" }
  if (password.length < 8) return { error: "Password must be at least 8 characters" }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return { error: "Email already in use" }

  const passwordHash = await bcrypt.hash(password, 12)
  await db.insert(users).values({
    id: crypto.randomUUID(),
    email,
    name,
    passwordHash,
  })

  await signIn("credentials", { email, password, redirectTo: "/dashboard" })
}

export async function login(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password" }
    throw e
  }
}
