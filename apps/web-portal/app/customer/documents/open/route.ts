import { NextResponse } from "next/server";
import { createCustomerDocumentSignedUrl } from "@/lib/customer-web-phase4-data";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer") ?? "";
  const documentId = url.searchParams.get("document") ?? "";
  const { account } = await resolveCustomerWebScope(customerId);
  const signedUrl = await createCustomerDocumentSignedUrl(account.id, documentId);
  if (!signedUrl) return NextResponse.json({ error: "Document could not be opened." }, { status: 404 });
  return NextResponse.redirect(signedUrl);
}