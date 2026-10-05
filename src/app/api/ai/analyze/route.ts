import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert consignment shop inventory assistant.
Analyze the product image and return a JSON object with these fields:
- title: concise product name (brand + type + key descriptor, max 60 chars)
- brand: brand name if visible, else null
- category: one of [Clothing, Shoes, Accessories, Furniture, Electronics, Books, Toys, Sports, Home Decor, Art, Jewelry, Other]
- condition: one of [New, Like New, Good, Fair, Poor]
- size: clothing/shoe size if applicable, else null
- color: primary color(s)
- description: 1-2 sentence description suitable for an online shop
- suggestedPrice: estimated fair resale price in USD as a number (be conservative)
- keywords: array of 3-5 searchable keywords

Respond ONLY with valid JSON. No markdown, no code fences, no explanation.`;

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

// Pull a JSON object out of the model's reply, tolerating stray prose or ```json fences.
function extractJson(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("No JSON found in response");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { imageUrl, imageBase64, mimeType } = body;

  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  const mediaType: AllowedMedia = ALLOWED_MEDIA.includes(mimeType) ? mimeType : "image/jpeg";

  const imageBlock: Anthropic.ImageBlockParam = imageBase64
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } }
    : { type: "image", source: { type: "url", url: imageUrl } };

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            imageBlock,
            { type: "text", text: "Analyze this item and return the JSON described in the system prompt." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = textBlock?.text || "";
    const parsed = extractJson(raw);

    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
    if (err.message?.includes("JSON")) {
      return NextResponse.json({ error: "AI returned invalid response, try again" }, { status: 422 });
    }
    return NextResponse.json({ error: err.message || "Analysis failed" }, { status: 500 });
  }
}
