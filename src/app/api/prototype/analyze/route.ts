import { analyzeImageWithGemini } from "@/lib/ai-photo-analyzer"

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, apiKey } = await req.json()

    if (!imageBase64) {
      return Response.json({ error: "Missing imageBase64" }, { status: 400 })
    }

    const aiResult = await analyzeImageWithGemini(imageBase64, mimeType ?? "image/jpeg", apiKey)

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
  } catch (err: any) {
    return Response.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}
