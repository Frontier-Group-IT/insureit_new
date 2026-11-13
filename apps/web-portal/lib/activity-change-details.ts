/**
 * Display-only audit summary. Never render arbitrary audit JSON: old_data/new_data
 * may include phone numbers, identity documents, or private financial information.
 * Caller must already have record-scoped read access.
 */
type Kind = "customer" | "vehicle";
const LABELS: Record<Kind, Record<string,string>> = {
  customer: {
    contact_name: "Customer name", company_name: "Company name",
    phone: "Mobile number", email: "Email", address: "Address",
    customer_type: "Customer type", partner_type: "Partner type",
    creation_channel: "Creation channel",
    lead_source_intermediary_id: "Lead source",
    origin_customer_id: "Parent customer",
    city: "City", state: "State", pincode: "PIN code",
    gstin: "GSTIN", pan: "PAN",
  },
  vehicle: {
    vehicle_no: "Registration number", vehicle_type: "Vehicle type",
    vehicle_class_code: "Vehicle class", vehicle_class_description: "Vehicle class description",
    make: "Manufacturer", model: "Model", year: "Manufacturing year",
    chassis_no: "Chassis number", engine_no: "Engine number",
    fuel_type: "Fuel type", engine_capacity_cc: "Engine capacity",
    seating_capacity: "Seating capacity", gvw_kg: "Gross vehicle weight",
    rto_name: "RTO", rto_state: "Registration state",
    customer_id: "Linked customer",
    registration_date: "Registration date",
  },
};
const PUBLIC_VALUES = new Set([
  "customer_type", "partner_type", "creation_channel",
  "vehicle_type", "vehicle_class_code", "vehicle_class_description",
  "make", "model", "year", "fuel_type", "engine_capacity_cc",
  "seating_capacity", "gvw_kg", "rto_state", "registration_date",
]);

function printable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "string" && typeof value !== "number") return "Changed";
  return String(value).trim().slice(0, 90) || "Not set";
}

function phoneMask(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? `••••••${digits.slice(-4)}` : "Not set";
}

function emailMask(value: unknown): string {
  if (typeof value !== "string" || !value.includes("@")) return value ? "••••" : "Not set";
  const [local, domain] = value.split("@");
  return `${local ? local.slice(0,1) + "•••" : "•••"}@${domain ?? "•••"}`;
}

/** Returns null for missing snapshots; [] means snapshots were present but no approved changed fields. */
export function describeAuditedChanges(
  kind: Kind,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] | null {
  if (!before || !after) return null;
  const labels = LABELS[kind];
  const result: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    if (!(key in before) || !(key in after)) continue;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    const format = key === "phone" ? phoneMask : key === "email" ? emailMask : PUBLIC_VALUES.has(key) ? printable : null;
    result.push(format
      ? `${label}: ${format(before[key])} → ${format(after[key])}`
      : `${label} changed (values hidden)`);
  }
  return result.slice(0, 30);
}

/** Labels supplied by a trusted writer, not from user-controlled text. */
export function describeNamedChanges(kind: Kind, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return [...new Set(raw.filter((name): name is string => typeof name === "string" && !!LABELS[kind][name]).map(name => `${LABELS[kind][name]} changed (values not recorded)`))].slice(0, 30);
}

export function activityChangeTitle(entity: string, changes: string[] | null): string {
  if (changes === null) return `${entity} edited — change details not recorded`;
  if (!changes.length) return `${entity} saved — no tracked field changes`;
  const names = changes.map(change => change.split(":")[0].replace(/ changed \(.*\)$/, ""));
  return names.length === 1 ? `${names[0]} changed` : `${names[0]} and ${names.length - 1} other field${names.length > 2 ? "s" : ""} changed`;
}
