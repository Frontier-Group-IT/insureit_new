import { NextResponse } from "next/server";
import { createScopedManualPospMispOnboarding } from "../../scoped-manual-action";

export async function POST(request: Request) {
  const data = await request.formData();
  const partnerType = data.get("partner_type") === "misp" ? "misp" : "posp";
  const result = await createScopedManualPospMispOnboarding({ error: null, field: null }, data);

  if (result.error) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("error", result.error);
    if (result.field) url.searchParams.set("field", result.field);
    return NextResponse.redirect(url, 303);
  }

  if (!result.applicationId) {
    const url = new URL("/customers/posp-misp/new", request.url);
    url.searchParams.set("partner_type", partnerType);
    url.searchParams.set("error", "The application was saved but its reference could not be returned. Open Onboarding Applications to continue.");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(
    new URL(`/intermediaries/applications/${result.applicationId}?success=posp_misp_submitted`, request.url),
    303,
  );
}
