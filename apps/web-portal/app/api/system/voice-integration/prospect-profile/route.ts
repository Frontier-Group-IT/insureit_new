import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import {
  type ExternalRenewalAiProfile,
  saveVoiceProspectAiProfile,
} from "@/lib/voice-prospect-profile";

function value(form: FormData, key: keyof ExternalRenewalAiProfile) {
  const raw = String(form.get(key) ?? "").replace(/\s+/g, " ").trim();
  return raw || null;
}

function safeReturnTo(request: NextRequest, form: FormData, opportunityId: string) {
  const fallback = `/system/voice-integration/prospects/${opportunityId}`;
  const requested = String(form.get("return_to") ?? "").trim();
  return requested.startsWith("/system/voice-integration") ? requested : fallback;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const opportunityId = String(form.get("opportunity_id") ?? "").trim();
  const returnTo = safeReturnTo(request, form, opportunityId);
  const target = new URL(returnTo, request.url);

  if (!opportunityId) {
    target.searchParams.set("profile_update", "failed");
    target.searchParams.set("profile_error", "Opportunity is required.");
    return NextResponse.redirect(target, 303);
  }

  const candidate: ExternalRenewalAiProfile = {
    customerName: value(form, "customerName"),
    mobile: value(form, "mobile"),
    registrationNumber: value(form, "registrationNumber"),
    manufacturer: value(form, "manufacturer"),
    model: value(form, "model"),
    chassisNumber: value(form, "chassisNumber"),
    insuranceCompany: value(form, "insuranceCompany"),
    policyNumber: value(form, "policyNumber"),
    policyExpiryDate: value(form, "policyExpiryDate"),
    previousIdv: value(form, "previousIdv"),
    previousPremium: value(form, "previousPremium"),
    registrationDate: value(form, "registrationDate"),
    manufacturingYear: value(form, "manufacturingYear"),
    vehicleClass: value(form, "vehicleClass"),
    fuelType: value(form, "fuelType"),
    engineCapacityCc: value(form, "engineCapacityCc"),
    seatingCapacity: value(form, "seatingCapacity"),
    gvwKg: value(form, "gvwKg"),
    fitnessExpiryDate: value(form, "fitnessExpiryDate"),
    pucExpiryDate: value(form, "pucExpiryDate"),
    roadTaxExpiryDate: value(form, "roadTaxExpiryDate"),
    nationalPermitExpiryDate: value(form, "nationalPermitExpiryDate"),
    localPermitExpiryDate: value(form, "localPermitExpiryDate"),
  };

  const phoneDigits = candidate.mobile?.replace(/\D/g, "") ?? "";
  if (candidate.mobile && !/^(?:91)?[6-9][0-9]{9}$/.test(phoneDigits)) {
    target.searchParams.set("profile_update", "failed");
    target.searchParams.set("profile_error", "Enter a valid Indian mobile number.");
    return NextResponse.redirect(target, 303);
  }

  for (const key of ["policyExpiryDate","registrationDate","fitnessExpiryDate","pucExpiryDate","roadTaxExpiryDate","nationalPermitExpiryDate","localPermitExpiryDate"] as const) {
    const date = candidate[key];
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      target.searchParams.set("profile_update", "failed");
      target.searchParams.set("profile_error", "One or more dates are invalid.");
      return NextResponse.redirect(target, 303);
    }
  }

  try {
    await saveVoiceProspectAiProfile({
      opportunityId,
      updatedBy: viewer.id,
      candidate,
    });
    target.searchParams.set("profile_update", "saved");
  } catch (error) {
    target.searchParams.set("profile_update", "failed");
    target.searchParams.set("profile_error", error instanceof Error ? error.message.slice(0, 160) : "Could not save profile.");
  }

  return NextResponse.redirect(target, 303);
}
