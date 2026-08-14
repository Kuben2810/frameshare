"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const fd = new FormData(e.currentTarget)
    const result = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    })
    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Studio panel */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-12 shrink-0"
        style={{ backgroundColor: "oklch(0.20 0.038 162)" }}
      >
        <span className="text-xs font-bold tracking-[0.2em] uppercase text-white/40 font-oswald">
          Frameshare Studio
        </span>
        <div className="space-y-4">
          <blockquote className="text-[22px] font-medium leading-[1.45] text-white/90 max-w-[280px]">
            &ldquo;A photograph is a secret about a secret. The more it tells you, the less you know.&rdquo;
          </blockquote>
          <p className="text-xs tracking-wider text-white/30">— Diane Arbus</p>
        </div>
        <p className="text-xs text-white/25">Professional gallery delivery for photographers.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[340px] space-y-7">
          <div className="lg:hidden">
            <span className="text-base font-bold tracking-[0.12em] font-oswald uppercase">Frameshare</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide font-oswald uppercase">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to continue</p>
          </div>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-9"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full h-9" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              No account?{" "}
              <Link href="/register" className="font-medium text-primary hover:underline underline-offset-4">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
