// Self-contained for the native Node --experimental-strip-types regression runner.
// Keep this strict allowed-key set aligned with policy-n8n-onboarding-fields.ts.
const ALLOWED_N8N_ONBOARDING_KEYS = new Set([
  "vehicle_class",
  "vehicle_fuel_type",
  "vehicle_motor_power_kw",
  "vehicle_capacity",
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_make",
  "vehicle_model",
  "vehicle_manufacturing_year",
  "vehicle_registration_year",
  "vehicle_registration_date",
  "vehicle_engine_number",
  "vehicle_chassis_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
  "policy_number",
  "insurer_name",
  "policy_product",
  "policy_start_date",
  "policy_end_date",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
]);



export type N8nPrefillField = { key: string; label: string; value: string };

export type ManufacturingYearEvidence = {
  year: string;
  source: "manufacturing_year" | "registration_year_fallback" | "missing";
};
/** InsureIt-approved operational rule: a missing manufacturing year may use
 * the *printed* registration year, never a guessed manufacture day/month.
 * Finance, identity, expiry and issue-date evidence is not affected.
 * Duplicate or contradictory source fields fail closed. */
export function resolveManufacturingYearEvidence(
  fields: readonly {key:string;value:string}[],
): ManufacturingYearEvidence {
  const unique = (key:string):string|null => {
    const values=fields.filter(f=>f.key===key);
    return values.length<=1 ? (values[0]?.value?.trim()??"") : null;
  };
  const mfg=unique("vehicle_manufacturing_year");
  const regYear=unique("vehicle_registration_year");
  const regDate=unique("vehicle_registration_date");
  if(mfg===null||regYear===null||regDate===null)
    return {year:"",source:"missing"};
  const allowedYear=(s:string)=> /^(?:19|20)\d{2}$/.test(s)
    && Number(s)<=new Date().getUTCFullYear() && Number(s)>=1900;
  if(allowedYear(mfg)) return {year:mfg,source:"manufacturing_year"};
  if(mfg && !/^(?:--|N\/A|NA|NOT AVAILABLE|UNKNOWN)$/i.test(mfg))
    return {year:"",source:"missing"};
  const datedYear=regDate ? (() => {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(regDate))return "";
    const time=new Date(regDate+"T00:00:00Z");
    return Number.isFinite(time.getTime())
      &&time.toISOString().slice(0,10)===regDate ? regDate.slice(0,4):"";
  })() : "";
  if(regDate && !datedYear)return {year:"",source:"missing"};
  if(regYear && !allowedYear(regYear))return {year:"",source:"missing"};
  if(regYear && datedYear && regYear!==datedYear)
    return {year:"",source:"missing"};
  const year=regYear||datedYear;
  if(!year||!allowedYear(year))return {year:"",source:"missing"};
  return {year,source:"registration_year_fallback"};
}


// These model families are documented electric Chetak scooters. Do not infer
// fuel, vehicle class or power from unrelated/unrecognised make/model text.
const KNOWN_CHETAK_ELECTRIC_MODELS = new Set([
  "C2501", "C3001", "C3501", "C3502", "C3503",
]);

/**
 * Product 3005 risk letters print both "CHETAK / C3503" and
 * "CHETAK / CHETAK 3503". Normalize ONLY exact verified C-series
 * naming aliases for matching; retain the PDF's actual model in the form.
 */
function knownChetakModelCode(raw: string): string {
  const canonical = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const parts = canonical.match(/^(?:C|CHETAK[ -]+)(2501|3001|3501|3502|3503)$/);
  const code = parts ? `C${parts[1]}` : "";
  return KNOWN_CHETAK_ELECTRIC_MODELS.has(code) ? code : "";
}

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
  parserId?: string,
): N8nPrefillField[] {
  const fields: N8nPrefillField[] = rawFields.filter(field => ALLOWED_N8N_ONBOARDING_KEYS.has(field.key)).map(field => ({
    key: field.key, label: field.label, value: field.value,
  }));
  const get = (key: string) => fields.find(field => field.key === key)?.value.trim() ?? "";

  // Digit labels its combined OD+TP policy "Digit Commercial Vehicle Insurance"
  // rather than "Package". Only the strict verified Digit 18-check parser may
  // normalize that into the canonical form's Package selection. Do not apply
  // this alias to generic OCR, ICICI, Tata, IFFCO, or New India.
  if (parserId === "go_digit_cv_native_pdf"
      && get("policy_product") === "Digit Commercial Vehicle Insurance"
      && /miscellaneous/i.test(get("vehicle_class"))
      && Number(get("od_premium")) > 0 && Number(get("tp_premium")) > 0) {
    const product = fields.find(field => field.key === "policy_product");
    if (product) product.value = "Package";
  }
  const add = (key: string, value: string, label: string) => {
    if (value && !get(key)) fields.push({ key, label, value });
  };

  const manufacturing=resolveManufacturingYearEvidence(rawFields);
  if(manufacturing.source==="registration_year_fallback"){
    // A literal "--" from the PDF is still a missing value, not a genuine
    // manufacture year. Replace only this placeholder in the derived copy.
    const current=fields.find(field=>field.key==="vehicle_manufacturing_year");
    if(current){
      current.value=manufacturing.year;
      current.label="Manufacturing year — registration-year fallback";
    } else {
      add("vehicle_manufacturing_year",manufacturing.year,"Manufacturing year — registration-year fallback");
    }
  }

  const isKnownChetak = get("vehicle_make").toUpperCase() === "CHETAK"
    && Boolean(knownChetakModelCode(get("vehicle_model")));
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
