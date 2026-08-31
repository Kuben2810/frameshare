import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { FrameshareLogo } from "@/components/frameshare-logo"
import { Images, Settings, LogOut, ExternalLink, Sparkles } from "lucide-react"
import { ensureActiveWorkspace } from "@/lib/workspace"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { workspace } = await ensureActiveWorkspace(session.user.id)

  const initials = workspace.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "FS"

  return (
    <div className="h-screen max-h-screen bg-background flex flex-col overflow-hidden selection:bg-primary/20">
      {/* ── Studio Navigation Header ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-card/80 backdrop-blur-md transition-colors shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Studio Nav */}
          <div className="flex items-center gap-6 md:gap-8">
            <Link href="/dashboard" className="group">
              <FrameshareLogo iconHeight={30} textSize="sm" />
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-foreground bg-muted/60 hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <Images className="h-3.5 w-3.5" />
                Collections
              </Link>
              <Link
                href="/dashboard/prototype"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>AI Studio (Prototype)</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className="px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors flex items-center gap-1.5"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </nav>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none focus:ring-2 focus:ring-primary/40 transition-all ml-1">
                <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/80 hover:ring-primary/50 transition-all">
                  {session.user.image && <AvatarImage src={session.user.image} alt={workspace.name} />}
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border-border/80">
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">{workspace.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 bg-border/60" />
                <DropdownMenuItem className="rounded-lg cursor-pointer">
                  <Link href="/dashboard" className="flex items-center gap-2 w-full">
                    <Images className="h-4 w-4 text-muted-foreground" />
                    <span>Collections</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer">
                  <Link href="/dashboard/settings" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span>Studio Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border/60" />
                <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer rounded-lg">
                  <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }) }} className="w-full">
                    <button type="submit" className="w-full text-left flex items-center gap-2">
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col w-full min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
