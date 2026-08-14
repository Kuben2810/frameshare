"use client"

import { createContext, useContext, useEffect, useState, useMemo } from "react"

type Theme = "dark" | "light" | "system"

type ThemeContextType = {
  theme: Theme
  resolvedTheme: "dark" | "light"
  setTheme: (theme: Theme) => void
  themes: string[]
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: () => {},
  themes: ["light", "dark", "system"],
})

export function ThemeProvider({
  children,
  defaultTheme = "system",
  attribute = "class",
  enableSystem = true,
  storageKey = "theme",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  attribute?: string
  enableSystem?: boolean
  storageKey?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as Theme | null
      if (stored) return stored
    }
    return defaultTheme
  })

  const [systemTheme, setSystemTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(media.matches ? "dark" : "light")

    const listener = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [])

  const resolvedTheme = useMemo(() => {
    if (theme === "system") return systemTheme
    return theme === "dark" ? "dark" : "light"
  }, [theme, systemTheme])

  useEffect(() => {
    if (typeof window === "undefined") return
    const root = document.documentElement
    if (attribute === "class") {
      root.classList.remove("light", "dark")
      root.classList.add(resolvedTheme)
    } else {
      root.setAttribute(attribute, resolvedTheme)
    }
  }, [resolvedTheme, attribute])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, newTheme)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, themes: ["light", "dark", "system"] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
