import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

export async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true },
  })

  if (!user) {
    redirect("/login")
  }

  return session.user.id
}
