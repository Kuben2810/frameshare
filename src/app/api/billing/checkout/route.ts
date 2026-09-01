import { auth } from "@/auth"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { buildCheckoutFields, PAYFAST_PROCESS_URL } from "@/lib/payfast"
import { PLANS, type PlanId } from "@/lib/plans"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { plan } = await req.json() as { plan?: string }
  if (!plan || !(plan in PLANS) || plan === "free") {
    return Response.json({ error: "Invalid plan" }, { status: 400 })
  }

  const { workspace } = await ensureActiveWorkspace(session.user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const fields = buildCheckoutFields({
    workspaceId: workspace.id,
    plan:        plan as PlanId,
    userEmail:   session.user.email ?? "",
    userName:    session.user.name  ?? "Photographer",
    appUrl,
  })

  return Response.json({ url: PAYFAST_PROCESS_URL, fields })
}
