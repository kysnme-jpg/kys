import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const runtime = "nodejs";

/**
 * AI item entry (Quick Intake, Add Item, Edit, Borrowed, Dealer).
 *
 * Claude looks at the photo and drafts the listing in the vocabulary of the
 * resale / luxury-consignment trade. Staff always review the draft before it is
 * saved. Nothing is looked up online: identification comes from the photo and
 * the model's own knowledge of brands and styles.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You write inventory listings for Classic Consigns by KYS, an upscale women's consignment boutique. Staff photograph each item at intake, and your draft becomes the listing they review, print on the hang tag, and publish in the online shop.

Write the way experienced resale and luxury-consignment listings are written (The RealReal, Fashionphile, top Poshmark sellers): precise, factual, and in the trade's own vocabulary, so a shopper can tell exactly what the piece is.

Identifying the item
- Name the brand when you can see it (logo, hardware stamp, label, monogram) or the design is unmistakable.
- Give the exact style or model name when you recognize it confidently (for example "Marc Jacobs The Snapshot", "Coach Tabby 26", "Christian Louboutin So Kate", "Tory Burch Miller"). If you aren't confident, leave styleName null and describe the item by its features instead: a wrong model name is worse than none, because buyers check.
- Never say or imply the item is authentic, genuine, or real. You can't authenticate from a photo, and the store authenticates separately.

Use the trade's terms for what you can see
- Bags: silhouette (crossbody, camera bag, tote, satchel, hobo, shoulder bag, clutch, wristlet, belt bag, bucket bag, top-handle, baguette); material and finish (pebbled, saffiano, smooth or patent leather, suede, nylon, coated canvas, quilted); hardware tone (gold-tone, silver-tone); closure (zip-top, flap, magnetic snap, turn-lock); strap (adjustable crossbody, chain, top handle); details (logo plaque, tassel, contrast stitching, interior pockets if shown).
- Shoes: type (pump, slingback, mule, slide, loafer, ballet flat, sandal, ankle bootie, knee-high boot, sneaker); toe (pointed, almond, round, square, peep or open toe); heel (stiletto, block, kitten, wedge, platform), with an approximate height only when it can be judged from the photo; upper material; closure; sole.
- Clothing: garment type; fabric and texture (crepe, silk charmeuse, knit, tweed, sequin, velvet, denim, lace); silhouette and fit (A-line, sheath, wrap, bodycon, relaxed, cropped); neckline; sleeve; length; closure; embellishment.
- Jewelry and accessories: piece type, metal tone, stones or embellishment, clasp.
Describe only what the photo shows or what is reliably true of that exact style. Don't invent measurements, fiber content, or materials you can't tell from the image; write "appears to be" when it's a judgment call.

Condition, on the store's scale
- New: new with tags, or clearly never worn.
- Like New: no visible wear.
- Good: gently used, minor wear.
- Fair: noticeable wear such as scuffs, corner wear, pilling, or fading.
- Poor: significant damage.
Use Good when the photo doesn't show enough to tell. Mention any visible wear in the description in resale terms ("light scuffing at the heel tips", "minor corner wear").

Fields
- title: brand, style name if known, key descriptor, and item type, most identifying words first. At most 60 characters, and make the first 40 count: that's what prints on the hang tag. Example: "Marc Jacobs Snapshot Camera Bag Black Multi".
- size: only when a size label or tag is visible. Shoes in US sizing; if the label shows only EU sizing, give the EU size and say so (e.g. "EU 38").
- color: the color name a fashion listing would use (black, camel, ivory, burgundy, champagne, multi).
- description: 2 to 4 sentences of listing copy for the online shop: what the piece is, its materials and construction, notable details, and its condition. No prices, no authenticity claims, no hype words ("stunning", "must-have").
- suggestedPrice: a conservative resale price in US dollars for a consignment boutique. Pre-owned designer pieces usually sell for roughly 25 to 50 percent of retail depending on brand, condition, and demand; contemporary and mall brands sell for less.
- keywords: 3 to 6 search terms a shopper would type.`;

const CATEGORIES = ["Clothing", "Shoes", "Handbags", "Accessories", "Jewelry", "Home Decor", "Art", "Other"];
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

/** Match a model answer to one of the allowed values (case-insensitive), else the fallback. */
function oneOf(value: string, allowed: string[], fallback: string): string {
  const v = String(value || "").trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v) ?? fallback;
}

// The draft Claude returns. Structured outputs guarantee this exact shape, so
// the response no longer needs to be fished out of free text.
const ItemDraft = z.object({
  title: z.string().describe("Brand, style name if known, descriptor and item type; at most 60 characters"),
  brand: z.string().nullable().describe("Brand name if visible or unmistakable, else null"),
  styleName: z.string().nullable().describe("Exact style or model name only if recognized confidently, else null"),
  category: z.string().describe(`One of: ${CATEGORIES.join(", ")}`),
  condition: z.string().describe(`One of: ${CONDITIONS.join(", ")}`),
  size: z.string().nullable().describe("Only when a size label or tag is visible, else null"),
  color: z.string().describe("Fashion-listing color name"),
  material: z.string().nullable().describe("Primary material, hedged with 'appears to be' when a judgment call; null if unclear"),
  description: z.string().describe("2-4 sentences of listing copy in resale-industry terms"),
  suggestedPrice: z.number().describe("Conservative consignment resale price in USD"),
  keywords: z.array(z.string()).describe("3-6 shopper search terms"),
});

/** Shorten to `max` characters at a word boundary (never mid-word). */
function fitTitle(title: string, max: number): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : t.slice(0, max)).trim();
}

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { imageUrl, imageBase64, mimeType } = body;

  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  const mediaType: AllowedMedia = ALLOWED_MEDIA.includes(mimeType) ? mimeType : "image/jpeg";

  const imageBlock: Anthropic.Beta.BetaImageBlockParam = imageBase64
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } }
    : { type: "image", source: { type: "url", url: imageUrl } };

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety check declines the photo, the API retries on a fallback
      // model inside the same call instead of failing the intake.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(ItemDraft),
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            imageBlock,
            { type: "text", text: "Draft the listing for this item." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The AI couldn't describe this photo. Please enter the details by hand." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return NextResponse.json({ error: "AI returned an incomplete response, try again" }, { status: 422 });
    }

    const draft = response.parsed_output;
    // Keep the title within the hang-tag limit even if the model runs long.
    const result = {
      ...draft,
      title: fitTitle(draft.title, 60),
      category: oneOf(draft.category, CATEGORIES, "Other"),
      condition: oneOf(draft.condition, CONDITIONS, "Good"),
    };
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "The AI is busy right now, try again in a moment" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
