import { NextResponse } from "next/server";
import { uploadInternalExchangePhoto } from "@/lib/exchange-internal-listing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const listingId = String(form.get("listingId") ?? "").trim();
    const label = String(form.get("label") ?? "").trim();
    const file = form.get("file");
    if (!listingId || !label || !(file instanceof File)) {
      return NextResponse.json({ error: "Listing, photo slot and image are required." }, { status: 400 });
    }
    const data = await uploadInternalExchangePhoto({ listingId, label, file });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exchange photo could not be uploaded." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
