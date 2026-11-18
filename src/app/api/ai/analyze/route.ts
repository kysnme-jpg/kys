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
 * saved.
 *
 * Optional online lookup (`lookup: true`): a first request lets Claude search
 * the web to confirm the exact style, materials and retail price, and returns
 * research notes plus the pages it used. The draft is then written from the
 * photo and those notes. The two steps are separate because web search always
 * attaches citations, which can't be combined with the structured (JSON-schema)
 * output the draft uses.
 */

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You write inventory listings for Classic Consigns by KYS, an upscale women's consignment boutique. Staff photograph each item at intake, and your draft becomes the listing they review, print on the hang tag, and publish in the online shop.

Write the way experienced resale and luxury-consignment listings are written (The RealReal, Fashionphile, top Poshmark sellers): precise, factual, and in the trade's own vocabulary, so a shopper can tell exactly what the piece is.

Identifying the item
- Name the brand when you can see it (logo, hardware stamp, label, monogram) or the design is unmistakable.
- Give the exact style or model name when you recognize it confidently (for example "Marc Jacobs The Snapshot", "Coach Tabby 26", "Christian Louboutin So Kate", "Tory Burch Miller"). If you aren't confident, leave styleName null and describe the item by its features instead: a wrong model name is worse than none, because buyers check.
- Never say or imply the item is authentic, genuine, or real. You can't authenticate from a photo, and the store authenticates separately.
- Sometimes you'll also get research notes from an online lookup. Use them to name the exact style and materials and to set the price, but only where they agree with what the photo shows; if they conflict, trust the photo. Treat a style the notes mark as "not found" or merely "likely" as unconfirmed.

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

const LOOKUP_PROMPT = `You help an upscale women's consignment boutique identify items at intake. Staff send a photo; your notes will be used to write the listing.

Identify the item as precisely as you can. Use web search to confirm what you can't be sure of from the photo alone: the exact style or model name, the materials and construction, and the original retail price. Prefer the brand's own site and established resale listings (The RealReal, Fashionphile, Vestiaire Collective, Poshmark, eBay sold listings). A few targeted searches are enough; stop once you have confirmed the style or have found that it can't be confirmed.

Write short plain-text notes covering:
- Brand, and the style or model name with how confident you are (confirmed by a matching listing, likely, or not found).
- Materials, hardware, construction and other details a listing should mention.
- Original retail price if you found it, and typical pre-owned prices you saw.
- Anything in the photo that doesn't match the style you found.

Never say the item is authentic or genuine; the store authenticates separately. If you can't confirm the style, say so plainly rather than guessing.`;

const LOOKUP_MAX_SEARCHES = 3;
const LOOKUP_MAX_RESUMES = 3; // continuations after a paused long-running search turn

type Source = { title: string; url: string };

/** Collect the pages the lookup used: cited pages first, then other search results. */
function collectSources(content: Anthropic.Beta.BetaContentBlock[]): Source[] {
  const seen = new Map<string, Source>();
  const add = (url?: string | null, title?: string | null) => {
    if (!url || seen.has(url)) return;
    let fallback = url;
    try { fallback = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep url */ }
    seen.set(url, { url, title: (title || "").trim() || fallback });
  };
  for (const block of content) {
    if (block.type === "text") {
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location") add(c.url, c.title);
      }
    }
  }
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) add(r.url, r.title);
    }
  }
  return [...seen.values()].slice(0, 5);
}

/**
 * Step 1 (optional): look the item up online. Returns the research notes and the
 * pages used, or null if nothing useful came back (the draft then works from the
 * photo alone).
 */
async function lookUpOnline(
  client: Anthropic,
  imageBlock: Anthropic.Beta.BetaImageBlockParam,
): Promise<{ notes: string; sources: Source[] } | null> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [imageBlock, { type: "text", text: "Identify this item and confirm the details online." }] },
  ];
  const content: Anthropic.Beta.BetaContentBlock[] = [];

  for (let attempt = 0; attempt <= LOOKUP_MAX_RESUMES; attempt++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: LOOKUP_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: LOOKUP_MAX_SEARCHES, user_location: { type: "approximate", country: "US" } }],
      messages,
    });
    content.push(...response.content);
    if (response.stop_reason === "refusal") return null;
    if (response.stop_reason !== "pause_turn") break;
    // A long search turn was paused: send it back unchanged so the server resumes.
    messages.push({ role: "assistant", content: response.content });
  }

  const notes = content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!notes) return null;
  return { notes: notes.slice(0, 6000), sources: collectSources(content) };
}

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
  const lookup = body.lookup === true;

  if (!imageUrl && !imageBase64) {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  const mediaType: AllowedMedia = ALLOWED_MEDIA.includes(mimeType) ? mimeType : "image/jpeg";

  const imageBlock: Anthropic.Beta.BetaImageBlockParam = imageBase64
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } }
    : { type: "image", source: { type: "url", url: imageUrl } };

  const client = new Anthropic({ apiKey });

  try {
    // Step 1 (optional): online lookup. Never fails the intake: if the search
    // step errors, the draft is still written from the photo alone.
    let research: { notes: string; sources: Source[] } | null = null;
    let lookupFailed = false;
    if (lookup) {
      try {
        research = await lookUpOnline(client, imageBlock);
        if (!research) lookupFailed = true;
      } catch (err) {
        lookupFailed = true;
        console.error("[ai/analyze] online lookup failed:", err instanceof Error ? err.message : err);
      }
    }

    const draftText = research
      ? `Draft the listing for this item.\n\nResearch notes from an online lookup:\n${research.notes}`
      : "Draft the listing for this item.";

    // Step 2: the listing draft, in the exact JSON shape the app expects.
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
            { type: "text", text: draftText },
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
    return NextResponse.json({
      result,
      lookup: lookup ? { done: !!research, failed: lookupFailed, sources: research?.sources ?? [] } : undefined,
    });
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
