import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}
