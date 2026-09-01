"use client"

import { useState } from "react"
import { CheckCircle2, Cloud, FolderOpen, Loader2, PlugZap, Unplug } from "lucide-react"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DriveConnection = {
  status: "active" | "needs_connection" | "error" | "disconnected"
  label: string
  rootReference: string | null
  lastError: string | null
} | null

type PickerDocument = { id?: string; name?: string }
type PickerCallbackData = { action: string; docs?: PickerDocument[] }
type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setAppId: (appId: string) => PickerBuilder
  setCallback: (callback: (data: PickerCallbackData) => void) => PickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

declare global {
  interface Window {
    gapi?: { load: (name: string, options: { callback: () => void }) => void }
    google?: {
      picker?: {
        Action: { PICKED: string; CANCEL: string }
        ViewId: { FOLDERS: string }
        DocsView: new (viewId: string) => { setSelectFolderEnabled: (enabled: boolean) => void }
        PickerBuilder: new () => PickerBuilder
      }
    }
  }
}

function loadPicker() {
  return new Promise<void>((resolve, reject) => {
    const complete = () => {
      if (window.gapi && window.google?.picker) {
        resolve()
      } else {
        reject(new Error("Google Picker did not load"))
      }
    }

    const loadModule = () => window.gapi?.load("picker", { callback: complete })
    if (window.gapi) {
      loadModule()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-picker="true"]')
    if (existing) {
      existing.addEventListener("load", loadModule, { once: true })
      existing.addEventListener("error", () => reject(new Error("Google Picker could not load")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = "https://apis.google.com/js/api.js"
    script.async = true
    script.dataset.googlePicker = "true"
    script.onload = loadModule
    script.onerror = () => reject(new Error("Google Picker could not load"))
    document.head.appendChild(script)
  })
}

export function GoogleDriveConnectionCard({
  connection,
  configured,
  pickerApiKey,
  pickerAppId,
  isWorkspaceDefault,
}: {
  connection: DriveConnection
  configured: boolean
  pickerApiKey: string | null
  pickerAppId: string | null
  isWorkspaceDefault: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function chooseFolder() {
    setBusy(true)
    try {
      const tokenResponse = await fetch("/api/storage/google-drive/picker-token", { cache: "no-store" })
      const tokenBody = await tokenResponse.json().catch(() => ({})) as { accessToken?: string; error?: string }
      if (!tokenResponse.ok || !tokenBody.accessToken) throw new Error(tokenBody.error ?? "Google Drive needs to be reconnected")
      if (!pickerApiKey || !pickerAppId) throw new Error("Google Drive Picker is not configured")
      await loadPicker()

      const picker = window.google?.picker
      if (!picker) throw new Error("Google Picker did not load")
      const view = new picker.DocsView(picker.ViewId.FOLDERS)
      view.setSelectFolderEnabled(true)
      const builtPicker = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(tokenBody.accessToken)
        .setDeveloperKey(pickerApiKey)
        .setAppId(pickerAppId)
        .setCallback(async (data) => {
          if (data.action !== picker.Action.PICKED) {
            setBusy(false)
            return
          }
          const selected = data.docs?.[0]
          if (!selected?.id) return
          try {
            const response = await fetch("/api/storage/google-drive/folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ folderId: selected.id }),
            })
            const body = await response.json().catch(() => ({})) as { error?: string; folder?: { name?: string } }
            if (!response.ok) throw new Error(body.error ?? "Folder could not be verified")
            toast.success(`${body.folder?.name ?? "Google Drive folder"} connected`)
            window.location.reload()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Folder could not be verified")
            setBusy(false)
          }
        })
        .build()
      builtPicker.setVisible(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open Google Drive")
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const response = await fetch("/api/storage/google-drive/disconnect", { method: "POST" })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Google Drive could not be disconnected")
      toast.success("Google Drive disconnected")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google Drive could not be disconnected")
      setBusy(false)
    }
  }

  async function makeDefault() {
    setBusy(true)
    try {
      const response = await fetch("/api/storage/google-drive/make-default", { method: "POST" })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Google Drive could not be selected")
      toast.success("Google Drive will store new galleries")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google Drive could not be selected")
      setBusy(false)
    }
  }

  const isActive = connection?.status === "active"
  const hasAuthorizedAccount = connection?.status === "needs_connection"

  return (
    <div className="rounded-2xl bg-card border border-border/80 p-6 md:p-7 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5 pb-2 border-b border-border/50">
        <Cloud className="h-4 w-4 text-primary" />
        <h3 className="text-base font-bold text-foreground font-oswald uppercase tracking-wide">Google Drive BYO Storage</h3>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/25 p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary")}>
            {isActive ? <CheckCircle2 className="size-4" /> : <FolderOpen className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isActive ? connection.label : hasAuthorizedAccount ? "Choose your Drive folder" : "Keep your originals in Google Drive"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isActive
                ? isWorkspaceDefault
                  ? "New galleries use this verified Drive folder. Existing galleries keep their original storage assignment."
                  : "Folder verified. Frameshare has access only to files and folders you select with Google Picker."
                : hasAuthorizedAccount
                  ? "Your Drive account is authorized. Select the dedicated folder where Frameshare may add gallery files."
                  : "Frameshare uses Google’s narrow Drive permission and never reuses your sign-in connection."}
            </p>
          </div>
        </div>
      </div>

      {!configured ? (
        <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">
          Google Drive storage is being prepared by Frameshare. It will appear here once its separate OAuth and Picker configuration is enabled.
        </p>
      ) : isActive ? (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {isWorkspaceDefault
              ? "Existing galleries remain where they are. New galleries will use Drive while Frameshare continues to handle private gallery delivery."
              : "Make Drive the default only when you want future galleries to keep their originals and generated variants in this folder."}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isWorkspaceDefault && (
              <button type="button" onClick={makeDefault} disabled={busy} className={cn(buttonVariants({ size: "sm" }), "rounded-xl gap-1.5")}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Use Drive for New Galleries
              </button>
            )}
            <button type="button" onClick={disconnect} disabled={busy} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl gap-1.5")}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Unplug className="size-3.5" />}
              Disconnect Drive
            </button>
          </div>
        </div>
      ) : hasAuthorizedAccount ? (
        <button type="button" onClick={chooseFolder} disabled={busy} className={cn(buttonVariants({ size: "sm" }), "rounded-xl gap-1.5")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
          Choose Drive Folder
        </button>
      ) : (
        <a href="/api/storage/google-drive/connect" className={cn(buttonVariants({ size: "sm" }), "rounded-xl gap-1.5 inline-flex")}>
          <PlugZap className="size-3.5" />
          Connect Google Drive
        </a>
      )}
    </div>
  )
}
