import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveWithinUploads, contentTypeFor } from "@/lib/storage";

export const runtime = "nodejs";

// Public: the storefront and dashboard both render these via <img>. Access is
// scoped by the unguessable UUID filename rather than auth.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  const resolved = resolveWithinUploads(segments || []);
  if (!resolved) return new NextResponse("Bad request", { status: 400 });

  try {
    const buffer = await readFile(resolved);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeFor(resolved),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
