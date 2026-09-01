import crypto from "crypto"
import { PLANS, type PlanId } from "@/lib/plans"

const SANDBOX = process.env.PAYFAST_SANDBOX === "true"

export const PAYFAST_MERCHANT_ID  = SANDBOX ? "10000100"      : (process.env.PAYFAST_MERCHANT_ID  ?? "")
export const PAYFAST_MERCHANT_KEY = SANDBOX ? "46f0cd694581a" : (process.env.PAYFAST_MERCHANT_KEY ?? "")
export const PAYFAST_HOST         = SANDBOX ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za"
export const PAYFAST_PROCESS_URL  = `${PAYFAST_HOST}/eng/process`

// PayFast signs params by building a query string in field-declaration order,
// URL-encoding values with PHP urlencode semantics (space → +), then MD5-ing.
function buildParamString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&")
}

export function signPayfastParams(params: Record<string, string>): string {
  return crypto.createHash("md5").update(buildParamString(params)).digest("hex")
}

export function verifyItn(body: Record<string, string>): boolean {
  const { signature, ...rest } = body
  if (!signature) return false
  return signPayfastParams(rest) === signature
}

export type CheckoutParams = {
  workspaceId: string
  plan: PlanId
  userEmail: string
  userName: string
  appUrl: string
}

export function buildCheckoutFields(p: CheckoutParams): Record<string, string> {
  const planDef = PLANS[p.plan]
  const amount  = planDef.priceZAR.toFixed(2)

  const fields: Record<string, string> = {
    merchant_id:       PAYFAST_MERCHANT_ID,
    merchant_key:      PAYFAST_MERCHANT_KEY,
    return_url:        `${p.appUrl}/dashboard/settings?billing=success`,
    cancel_url:        `${p.appUrl}/dashboard/settings?billing=cancelled`,
    notify_url:        `${p.appUrl}/api/billing/itn`,
    name_first:        p.userName.split(" ")[0] ?? p.userName,
    name_last:         p.userName.split(" ").slice(1).join(" ") || " ",
    email_address:     p.userEmail,
    m_payment_id:      `${p.workspaceId}:${p.plan}`,
    amount,
    item_name:         `Frameshare ${planDef.label}`,
    subscription_type: "1",
    recurring_amount:  amount,
    frequency:         "3",
    cycles:            "0",
  }

  fields.signature = signPayfastParams(fields)
  return fields
}
