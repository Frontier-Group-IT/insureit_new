import { NextResponse } from "next/server";
import {
  listInternalExchangeCustomers,
  loadInternalExchangeCustomerContext,
  saveInternalExchangeDraft,
  submitInternalExchangeListing,
} from "@/lib/exchange-internal-listing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function message(error: unknown) {
  return error instanceof Error ? error.message : "Exchange listing request could not be completed.";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId")?.trim();
    if (customerId) {
      const data = await loadInternalExchangeCustomerContext(customerId);
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
    const customers = await listInternalExchangeCustomers();
    return NextResponse.json({ customers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    if (body.action === "save_draft") {
      const data = await saveInternalExchangeDraft({
        listingId: typeof body.listingId === "string" ? body.listingId : null,
        customerId: String(body.customerId ?? ""),
        vehicleId: String(body.vehicleId ?? ""),
        title: String(body.title ?? ""),
        category: String(body.category ?? ""),
        odometerKm: Number(body.odometerKm),
        askingPrice: Number(body.askingPrice),
        sellingMode: String(body.sellingMode ?? ""),
        tyreConditionPercent: body.tyreConditionPercent === null || body.tyreConditionPercent === undefined || body.tyreConditionPercent === ""
          ? null
          : Number(body.tyreConditionPercent),
        conditionDetails: body.conditionDetails && typeof body.conditionDetails === "object" && !Array.isArray(body.conditionDetails)
          ? body.conditionDetails as Record<string, unknown>
          : {},
      });
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "submit") {
      const listingId = String(body.listingId ?? "").trim();
      if (!listingId) return NextResponse.json({ error: "Listing reference is required." }, { status: 400 });
      const data = await submitInternalExchangeListing(listingId);
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Unsupported Exchange listing action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
