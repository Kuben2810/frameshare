import { db } from "@/db"
import { workspaces } from "@/db/schema"
import { eq } from "drizzle-orm"
import { verifyItn, PAYFAST_MERCHANT_ID } from "@/lib/payfast"
import { PLANS, type PlanId } from "@/lib/plans"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const text = await req.text()
  const body = Object.fromEntries(new URLSearchParams(text)) as Record<string, string>

  if (!verifyItn(body)) {
    console.error("[itn] signature mismatch", body)
    return new Response("Invalid signature", { status: 400 })
  }

  if (body.merchant_id !== PAYFAST_MERCHANT_ID) {
    return new Response("Merchant mismatch", { status: 400 })
  }

  // m_payment_id format: "workspaceId:planId"
  const [workspaceId, planId] = (body.m_payment_id ?? "").split(":")
  if (!workspaceId || !planId || !(planId in PLANS)) {
    return new Response("Invalid payment reference", { status: 400 })
  }

  const plan   = planId as PlanId
  const token  = body.token ?? null
  const status = body.payment_status

  if (status === "COMPLETE") {
    await db.update(workspaces)
      .set({
        plan,
        planStatus:       "active",
        planExpiresAt:    null,
        payfastToken:     token,
        storageQuotaBytes: PLANS[plan].quotaBytes,
        updatedAt:        new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
  } else if (status === "CANCELLED") {
    await db.update(workspaces)
      .set({ planStatus: "cancelled", updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
  }

  return new Response("OK")
}
