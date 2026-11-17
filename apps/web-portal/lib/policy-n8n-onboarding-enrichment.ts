import { filterVerifiedN8nOnboardingFields } from "./policy-n8n-onboarding-fields";

export type N8nPrefillField = { key: string; label: string; value: string };

// These model families are documented electric Chetak scooters. Do not infer
// fuel, vehicle class or power from unrelated/unrecognised make/model text.
const KNOWN_CHETAK_ELECTRIC_MODELS = new Set([
  "C2501", "C3001", "C3501", "C3502", "C3503",
]);

const VERIFIED_STATE_NAMES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Delhi", "Chandigarh", "Puducherry", "Ladakh",
  "Jammu and Kashmir", "Andaman and Nicobar Islands", "Lakshadweep",
  "Dadra and Nagar Haveli and Daman and Diu",
];

export function splitN8nRtoStateAndCity(raw: string) {
  const parts = raw.trim().split(/\s*[-–]\s*/);
  if (parts.length !== 2) return null;
  const compact = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const state = VERIFIED_STATE_NAMES.find(name => compact(name) === compact(parts[0]));
  if (!state || !/^[a-z][a-z .'-]{1,59}$/i.test(parts[1])) return null;
  const city = parts[1].toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());
  return { state, city };
}

/**
 * n8n's strict ICICI Product 3005 validator has already checked the PDF.
 * Enrich only independently supportable canonical choices, using live
 * manufacturer options. Identity fields are excluded (including future keys).
 * Capacity/kW must be explicitly extracted from the PDF, never guessed.
 */
export function enrichVerifiedN8nOnboardingFields<T extends N8nPrefillField>(
  rawFields: readonly T[],
  manufacturerOptions: readonly string[],
): N8nPrefillField[] {
  const fields: N8nPrefillField[] = filterVerifiedN8nOnboardingFields(rawFields).map(field => ({
    key: field.key, label: field.label, value: field.value,
  }));
  const get = (key: string) => fields.find(field => field.key === key)?.value.trim() ?? "";
  const add = (key: string, value: string, label: string) => {
    if (value && !get(key)) fields.push({ key, label, value });
  };

  const isKnownChetak = get("vehicle_make").toUpperCase() === "CHETAK"
    && KNOWN_CHETAK_ELECTRIC_MODELS.has(get("vehicle_model").toUpperCase());
  // Insurer Product Code 3005 is the verified bundled two-wheeler layout.
  if (isKnownChetak && get("policy_product").toLowerCase() === "bundled") {
    add("vehicle_class", "TWP", "Verified two-wheeler class");
    add("vehicle_fuel_type", "Electric", "Known Chetak electric model");
    // Resolve the precise Bajaj select option in the canonical mapper. Keep
    // original CHETAK evidence intact for the model-specific kW path.
  }

  const rto = splitN8nRtoStateAndCity(get("vehicle_rto_name"));
  if (rto) {
    const name = fields.find(field => field.key === "vehicle_rto_name");
    if (name) name.value = rto.city;
    add("vehicle_rto_state", rto.state, "Verified RTO state");
  }

  return fields;
}
