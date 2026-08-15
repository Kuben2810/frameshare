import { auth } from "@/auth"
import { MarketingLanding } from "@/components/marketing-landing"

export default async function HomePage() {
  const session = await auth()

  return <MarketingLanding userSession={session?.user} />
}
