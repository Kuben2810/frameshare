import { auth } from "@/auth"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { ensureActiveWorkspace } from "@/lib/workspace"
import { redirect } from "next/navigation"

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { workspace } = await ensureActiveWorkspace(session.user.id)
  if (workspace.onboardingCompletedAt) redirect("/dashboard")

  return (
    <OnboardingFlow
      defaultWorkspaceName={workspace.name}
      defaultAccentColor={workspace.accentColor ?? "#000000"}
    />
  )
}
