import { PrototypeStudio } from "@/components/prototype/prototype-studio"

export const metadata = {
  title: "AI Creative Studio Prototype | Frameshare",
  description: "Interactive prototype for AI-powered photo editing and content-aware enhancements in Frameshare.",
}

export default function PrototypeStandalonePage() {
  return (
    <div className="h-screen w-screen max-h-screen overflow-hidden flex flex-col bg-[#0c0c0e]">
      <PrototypeStudio />
    </div>
  )
}
