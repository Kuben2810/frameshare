const GB = 1_073_741_824

export const PLANS = {
  free: {
    label:        "Free",
    priceZAR:     0,
    maxGalleries: 1,
    quotaBytes:   2 * GB,
    byoStorage:   false,
    features:     ["1 gallery", "2 GB storage", "Client proofing", "Watermarked previews"],
  },
  solo: {
    label:        "Solo",
    priceZAR:     149,
    maxGalleries: 10,
    quotaBytes:   30 * GB,
    byoStorage:   false,
    features:     ["10 galleries", "30 GB storage", "Client downloads", "Full branding"],
  },
  pro: {
    label:        "Pro",
    priceZAR:     299,
    maxGalleries: null,
    quotaBytes:   100 * GB,
    byoStorage:   true,
    features:     ["Unlimited galleries", "100 GB storage", "Google Drive BYO", "AI photo studio"],
  },
  studio: {
    label:        "Studio",
    priceZAR:     549,
    maxGalleries: null,
    quotaBytes:   250 * GB,
    byoStorage:   true,
    features:     ["Unlimited galleries", "250 GB storage", "Google Drive + S3 BYO", "Team seats (coming soon)"],
  },
} as const

export type PlanId = keyof typeof PLANS

export function getPlan(id: string): (typeof PLANS)[PlanId] {
  return PLANS[id as PlanId] ?? PLANS.free
}

export function planAllowsGallery(plan: PlanId, currentCount: number): boolean {
  const limit = PLANS[plan].maxGalleries
  return limit === null || currentCount < limit
}

export function planAllowsByo(plan: PlanId): boolean {
  return PLANS[plan].byoStorage
}
