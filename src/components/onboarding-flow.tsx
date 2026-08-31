"use client"

import { useActionState, useState } from "react"
import { completeOnboarding, type OnboardingState } from "@/app/actions/onboarding"
import { ArrowLeft, ArrowRight, Check, ImagePlus, Palette, Sparkles } from "lucide-react"

type OnboardingFlowProps = {
  defaultWorkspaceName: string
  defaultAccentColor: string
}

export function OnboardingFlow({ defaultWorkspaceName, defaultAccentColor }: OnboardingFlowProps) {
  const [step, setStep] = useState(1)
  const [workspaceName, setWorkspaceName] = useState(defaultWorkspaceName)
  const [galleryName, setGalleryName] = useState("")
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {})

  const canAdvance = step === 1 ? workspaceName.trim().length > 0 : step === 3 ? galleryName.trim().length > 0 : true

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Frameshare setup</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Share your first client gallery</h1>
            <p className="mt-2 text-sm text-muted-foreground">A few details now; you can refine everything later.</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            Step {step} of 3
          </span>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-2" aria-label={`Onboarding step ${step} of 3`}>
          {[1, 2, 3].map((number) => (
            <div key={number} className={`h-1.5 rounded-full ${number <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <form action={formAction} className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <section className={step === 1 ? "space-y-6" : "hidden"} aria-hidden={step !== 1}>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
            <div>
              <h2 className="text-xl font-semibold">Name your studio</h2>
              <p className="mt-1 text-sm text-muted-foreground">This is what clients will see on their gallery.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="workspaceName" className="text-sm font-medium">Studio name</label>
              <input id="workspaceName" name="workspaceName" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required maxLength={120} placeholder="e.g. Elena Vance Photography" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </section>

          <section className={step === 2 ? "space-y-6" : "hidden"} aria-hidden={step !== 2}>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Palette className="size-5" /></div>
            <div>
              <h2 className="text-xl font-semibold">Make it feel like yours</h2>
              <p className="mt-1 text-sm text-muted-foreground">Branding is optional now and can be changed in Studio settings.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <label htmlFor="logo" className="text-sm font-medium">Studio logo <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground" />
              </div>
              <div className="space-y-2">
                <label htmlFor="accentColor" className="text-sm font-medium">Accent colour</label>
                <input id="accentColor" name="accentColor" type="color" defaultValue={defaultAccentColor} className="h-11 w-20 cursor-pointer rounded-xl border border-input bg-background p-1" />
              </div>
            </div>
          </section>

          <section className={step === 3 ? "space-y-6" : "hidden"} aria-hidden={step !== 3}>
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImagePlus className="size-5" /></div>
            <div>
              <h2 className="text-xl font-semibold">Create your first proofing gallery</h2>
              <p className="mt-1 text-sm text-muted-foreground">You will upload photos and copy the client link on the next screen.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="galleryName" className="text-sm font-medium">Gallery name</label>
              <input id="galleryName" name="galleryName" value={galleryName} onChange={(event) => setGalleryName(event.target.value)} required maxLength={160} placeholder="e.g. The Mokoena family session" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </section>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            {state.error && <p role="alert" className="mr-auto text-sm font-medium text-destructive">{state.error}</p>}
            {step > 1 ? (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /> Back</button>
            ) : <span />}
            {step < 3 ? (
              <button type="button" disabled={!canAdvance} onClick={() => setStep((current) => current + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><span>{step === 2 ? "Continue" : "Next"}</span><ArrowRight className="size-4" /></button>
            ) : (
              <button type="submit" disabled={!canAdvance || pending} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-4" /> {pending ? "Creating gallery..." : "Create gallery"}</button>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
