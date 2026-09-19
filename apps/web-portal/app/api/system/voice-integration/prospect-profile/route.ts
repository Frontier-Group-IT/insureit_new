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
    registrationDate: value(form, "registrationDate"),
    rto: value(form, "rto"),
    rcStatus: value(form, "rcStatus"),
    rcStatusAsOn: value(form, "rcStatusAsOn"),
    rcOwnerName: value(form, "rcOwnerName"),
    ownerSerialNumber: value(form, "ownerSerialNumber"),
    fatherHusbandName: value(form, "fatherHusbandName"),
    permanentAddress: value(form, "permanentAddress"),
    presentAddress: value(form, "presentAddress"),
    manufacturer: value(form, "manufacturer"),
    model: value(form, "model"),
    manufactureDate: value(form, "manufactureDate"),
    manufacturingYear: value(form, "manufacturingYear"),
    vehicleClass: value(form, "vehicleClass"),
    vehicleCategory: value(form, "vehicleCategory"),
    bodyType: value(form, "bodyType"),
    color: value(form, "color"),
    fuelType: value(form, "fuelType"),
    normsType: value(form, "normsType"),
    engineNumber: value(form, "engineNumber"),
    engineCapacityCc: value(form, "engineCapacityCc"),
    cylinderCount: value(form, "cylinderCount"),
    seatingCapacity: value(form, "seatingCapacity"),
    standingCapacity: value(form, "standingCapacity"),
    sleeperCapacity: value(form, "sleeperCapacity"),
    wheelBaseMm: value(form, "wheelBaseMm"),
    gvwKg: value(form, "gvwKg"),
    unladenWeightKg: value(form, "unladenWeightKg"),
    commercial: value(form, "commercial"),
    chassisNumber: value(form, "chassisNumber"),
    fitnessExpiryDate: value(form, "fitnessExpiryDate"),
    roadTaxExpiryDate: value(form, "roadTaxExpiryDate"),
    vehicleTaxUptoDate: value(form, "vehicleTaxUptoDate"),
    pucNumber: value(form, "pucNumber"),
    pucExpiryDate: value(form, "pucExpiryDate"),
    permitNumber: value(form, "permitNumber"),
    permitType: value(form, "permitType"),
    permitIssueDate: value(form, "permitIssueDate"),
    permitValidFrom: value(form, "permitValidFrom"),
    localPermitExpiryDate: value(form, "localPermitExpiryDate"),
    nationalPermitNumber: value(form, "nationalPermitNumber"),
    nationalPermitIssuedBy: value(form, "nationalPermitIssuedBy"),
    nationalPermitExpiryDate: value(form, "nationalPermitExpiryDate"),
    financed: value(form, "financed"),
    financerName: value(form, "financerName"),
    insuranceCompany: value(form, "insuranceCompany"),
    policyNumber: value(form, "policyNumber"),
    policyExpiryDate: value(form, "policyExpiryDate"),
    blacklistStatus: value(form, "blacklistStatus"),
    nocDetails: value(form, "nocDetails"),
    previousIdv: value(form, "previousIdv"),
    previousPremium: value(form, "previousPremium"),
  };

  const phoneDigits = candidate.mobile?.replace(/\D/g, "") ?? "";
  if (candidate.mobile && !/^(?:91)?[6-9][0-9]{9}$/.test(phoneDigits)) {
    target.searchParams.set("profile_update", "failed");
    target.searchParams.set("profile_error", "Enter a valid Indian mobile number.");
    return NextResponse.redirect(target, 303);
  }

  for (const key of [
    "policyExpiryDate","registrationDate","rcStatusAsOn","fitnessExpiryDate","pucExpiryDate","roadTaxExpiryDate",
    "vehicleTaxUptoDate","permitIssueDate","permitValidFrom","nationalPermitExpiryDate","localPermitExpiryDate",
  ] as const) {
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
