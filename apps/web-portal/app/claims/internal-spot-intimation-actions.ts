"use server";

import { advanceClaimWorkflow, saveSpotIntimationDetails } from "@/app/actions";

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function combineDateAndTime(formData: FormData, dateField: string, timeField: string) {
  const date = textValue(formData, dateField);
  const time = textValue(formData, timeField);
  if (!date || !time) return;
  formData.set(dateField, `${date}T${time}`);
}

function normalizeSpotIntimationDateTimes(formData: FormData) {
  combineDateAndTime(formData, "incident_at", "incident_time");
  combineDateAndTime(formData, "spot_intimation_at", "spot_intimation_time");
}

function requireInternalSpotIntimationDriverDetails(formData: FormData) {
  const missing = [
    ["Driver Name", textValue(formData, "driver_name")],
    ["Driver Number", textValue(formData, "driver_phone")],
    ["Location", textValue(formData, "location") ?? textValue(formData, "accident_location")],
  ].filter((entry) => !entry[1]).map((entry) => entry[0]);

  if (missing.length) {
    throw new Error(`Please complete the required Spot Intimation fields: ${missing.join(", ")}.`);
  }
}

export async function advanceInternalSpotIntimation(claimId: string, formData: FormData) {
  normalizeSpotIntimationDateTimes(formData);
  requireInternalSpotIntimationDriverDetails(formData);
  return advanceClaimWorkflow(claimId, formData);
}

export async function saveInternalSpotIntimationDetails(claimId: string, formData: FormData) {
  normalizeSpotIntimationDateTimes(formData);
  requireInternalSpotIntimationDriverDetails(formData);
  return saveSpotIntimationDetails(claimId, formData);
}
