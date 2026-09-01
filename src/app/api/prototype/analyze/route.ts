import { analyzeImageWithGemini } from "@/lib/ai-photo-analyzer"
import { auth } from "@/auth"
import { db } from "@/db"
import { prototypeAnalysisRateLimits } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

const MAX_REQUEST_BYTES = 3 * 1024 * 1024
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_ENCODED_IMAGE_CHARACTERS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const MAX_ANALYSES_PER_WINDOW = 12
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/

async function consumeAnalysisAllowance(userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`prototype-analysis:${userId}`}))`)

    const now = new Date()
    const [rateLimit] = await tx
      .select()
      .from(prototypeAnalysisRateLimits)
      .where(eq(prototypeAnalysisRateLimits.userId, userId))
      .limit(1)

    if (!rateLimit) {
      await tx.insert(prototypeAnalysisRateLimits).values({
        userId,
        windowStartedAt: now,
        attempts: 1,
      })
      return true
    }

    if (now.getTime() - rateLimit.windowStartedAt.getTime() >= RATE_LIMIT_WINDOW_MS) {
      await tx
        .update(prototypeAnalysisRateLimits)
        .set({ windowStartedAt: now, attempts: 1 })
        .where(eq(prototypeAnalysisRateLimits.userId, userId))
      return true
    }

    if (rateLimit.attempts >= MAX_ANALYSES_PER_WINDOW) return false

    await tx
      .update(prototypeAnalysisRateLimits)
      .set({ attempts: rateLimit.attempts + 1 })
      .where(eq(prototypeAnalysisRateLimits.userId, userId))
    return true
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const contentLength = Number(req.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "Image payload is too large" }, { status: 413 })
  }

  try {
    const { imageBase64, mimeType, apiKey } = await req.json()

    if (
      typeof imageBase64 !== "string"
      || imageBase64.length > MAX_ENCODED_IMAGE_CHARACTERS
      || (typeof apiKey !== "undefined" && (typeof apiKey !== "string" || apiKey.length > 256))
    ) {
      return Response.json({ error: "Invalid request" }, { status: 400 })
    }

    const imageMatch = DATA_URL_PATTERN.exec(imageBase64)
    if (!imageMatch || (mimeType !== undefined && mimeType !== imageMatch[1])) {
      return Response.json({ error: "Only JPEG, PNG, and WebP image data URLs are supported" }, { status: 415 })
    }

    const encodedImage = imageMatch[2]
    const paddingLength = encodedImage.endsWith("==") ? 2 : encodedImage.endsWith("=") ? 1 : 0
    const imageBytes = Math.floor((encodedImage.length * 3) / 4) - paddingLength
    if (imageBytes > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image is too large" }, { status: 413 })
    }

    const allowed = await consumeAnalysisAllowance(session.user.id)
    if (!allowed) {
      return Response.json({ error: "Analysis limit reached. Please try again later." }, { status: 429 })
    }

    const aiResult = await analyzeImageWithGemini(imageBase64, imageMatch[1], apiKey)

    if (aiResult) {
      return Response.json({
        success: true,
        source: "gemini-vision",
        analysis: aiResult,
      })
    }

    return Response.json({
      success: false,
      source: "heuristic-fallback",
      message: "Gemini Vision key not provided or request failed. Using local heuristic vision analyzer.",
    })
  } catch (error) {
    console.error("[PROTOTYPE ANALYSIS ERROR]", error)
    return Response.json({ error: "Analysis request failed" }, { status: 500 })
  }
}
