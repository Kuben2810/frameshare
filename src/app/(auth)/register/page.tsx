"use client"

import { useState } from "react"
import Link from "next/link"
import { register } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RegisterPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const fd = new FormData(e.currentTarget)
    const result = await register(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Studio panel */}
      <div
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-12 shrink-0"
        style={{ backgroundColor: "oklch(0.20 0.038 162)" }}
      >
        <span className="text-xs font-semibold tracking-[0.18em] uppercase text-white/35">
          Frameshare
        </span>
        <div>
          <p className="text-[22px] font-medium leading-[1.45] text-white/90 max-w-[280px]">
            Your work deserves a delivery experience as considered as the work itself.
          </p>
        </div>
        <p className="text-xs text-white/25">Professional gallery delivery for photographers.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[340px] space-y-7">
          <div className="lg:hidden">
            <span className="text-base font-medium tracking-[0.06em]">Frameshare</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start sharing galleries with your clients</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
            <Button type="submit" className="w-full h-9" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
