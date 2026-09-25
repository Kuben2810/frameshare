import { signOut } from "@/auth"

// Also the exit for stale sessions (user row deleted): /login would bounce a
// signed-in cookie straight back to /dashboard.
export async function GET() {
  await signOut({ redirectTo: "/login" })
}
