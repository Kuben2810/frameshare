"use client"

import { useState } from "react"
import { Check, Loader2, Zap } from "lucide-react"
import { PLANS, type PlanId } from "@/lib/plans"
import { cn } from "@/lib/utils"

const PLAN_ORDER: PlanId[] = ["free", "solo", "pro", "studio"]

export function BillingSection({ currentPlan, planStatus }: { currentPlan: PlanId; planStatus: string }) {
  const [loading, setLoading] = useState<PlanId | null>(null)

  async function upgrade(plan: PlanId) {
    setLoading(plan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const { url, fields } = await res.json() as { url: string; fields: Record<string, string> }

      // Auto-submit to PayFast hosted checkout
      const form = document.createElement("form")
      form.method = "POST"
      form.action = url
      for (const [k, v] of Object.entries(fields)) {
        const input = document.createElement("input")
        input.type  = "hidden"
        input.name  = k
        input.value = v
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">Plan & Billing</h3>
      </div>

      {planStatus === "cancelled" && (
        <p className="text-xs text-destructive">
          Your subscription is cancelled. You can resubscribe below.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_ORDER.map((id) => {
          const plan   = PLANS[id]
          const active = id === currentPlan
          const free   = id === "free"

          return (
            <div
              key={id}
              className={cn(
                "rounded-2xl border p-5 space-y-3 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-bold text-base font-oswald uppercase tracking-wide">{plan.label}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {plan.priceZAR === 0 ? "Free" : `R${plan.priceZAR}/mo`}
                </span>
              </div>

              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {active ? (
                <div className="text-xs font-semibold text-primary">Current plan</div>
              ) : free ? (
                <div className="text-xs text-muted-foreground">Default</div>
              ) : (
                <button
                  onClick={() => upgrade(id)}
                  disabled={loading !== null}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {loading === id && <Loader2 className="h-3 w-3 animate-spin" />}
                  {id === "solo" || PLANS[id].priceZAR > PLANS[currentPlan].priceZAR ? "Upgrade" : "Switch"}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Payments processed securely by PayFast. Cancel anytime from your PayFast account.
      </p>
    </div>
  )
}
