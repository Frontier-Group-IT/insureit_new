export type InternalSpotIntimationDetails = {
  incident_at: string | null;
  spot_intimation_at: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  location: string | null;
  accident_description: string | null;
};

type StageDetailLike = {
  details: Record<string, unknown> | null;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function storedOrFallback(details: Record<string, unknown>, key: string, fallback: string | null) {
  return Object.prototype.hasOwnProperty.call(details, key) ? stringValue(details[key]) : fallback;
}

function legacyDriverName(description: string | null) {
  if (!description) return null;
  const match = description.match(/driver\s*name?\s*[:\-]\s*([^,;\n]+)/i);
  return match?.[1]?.trim() || null;
}

function legacyDriverPhone(description: string | null) {
  if (!description) return null;
  const match = description.match(/(?:mobile|phone|contact)\s*[:\-]\s*(\+?\d[\d\s-]{7,})/i) ?? description.match(/\b(\+?91[-\s]?)?[6-9]\d{9}\b/);
  return match?.[0]?.replace(/^(mobile|phone|contact)\s*[:\-]\s*/i, "").trim() || null;
}

export function readInternalSpotIntimationDetails(rows: StageDetailLike[], claim: {
  accident_at?: string | null;
  accident_location?: string | null;
  accident_description?: string | null;
}) {
  const row = rows.find((item) => item.details?.milestone_key === "spot_intimation" || typeof item.details?.spot_intimation_at === "string" || typeof item.details?.incident_at === "string");
  const details = row?.details ?? {};
  const description = stringValue(details.accident_description) ?? claim.accident_description ?? null;
  return {
    incident_at: stringValue(details.incident_at) ?? stringValue(details.accident_at) ?? claim.accident_at ?? null,
    spot_intimation_at: stringValue(details.spot_intimation_at),
    driver_name: storedOrFallback(details, "driver_name", legacyDriverName(description)),
    driver_phone: storedOrFallback(details, "driver_phone", legacyDriverPhone(description)),
    location: storedOrFallback(details, "location", storedOrFallback(details, "accident_location", claim.accident_location ?? null)),
    accident_description: description
  } satisfies InternalSpotIntimationDetails;
}

export function validateInternalSpotIntimation(incidentAt: string | null, spotIntimationAt: string | null, now = Date.now()) {
  if (!incidentAt || !spotIntimationAt) {
    throw new Error("Accident date/time and Spot Intimation date/time are required.");
  }
  const incident = new Date(incidentAt);
  const intimation = new Date(spotIntimationAt);
  if (Number.isNaN(incident.getTime()) || Number.isNaN(intimation.getTime())) {
    throw new Error("Enter valid accident and Spot Intimation date/time values.");
  }
  if (incident.getTime() > now || intimation.getTime() > now) {
    throw new Error("Accident and Spot Intimation date/time cannot be in the future.");
  }
  if (intimation.getTime() < incident.getTime()) {
    throw new Error("Spot Intimation cannot be earlier than the accident.");
  }
  return { incidentAt: incident.toISOString(), spotIntimationAt: intimation.toISOString() };
}
