import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

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

Respond ONLY with valid JSON. No markdown, no explanation.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  const body = await req.json();
  const { imageUrl, imageBase64, mimeType } = body;

  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });

  const imageContent =
    imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl, detail: "high" as const } }
      : { type: "image_url" as const, image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`, detail: "high" as const } };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [imageContent] },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({ result: parsed });
  } catch (err: any) {
    if (err.message?.includes("JSON")) {
      return NextResponse.json({ error: "AI returned invalid response, try again" }, { status: 422 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
