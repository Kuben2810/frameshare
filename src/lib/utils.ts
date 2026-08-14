import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000"
  return url.replace(/\/+$/, "")
}
