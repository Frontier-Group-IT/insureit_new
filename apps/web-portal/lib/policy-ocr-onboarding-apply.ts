export type OcrImportField = {
  key: string;
  label: string;
  value: string;
};

export type OcrOperationalState = {
  registrationNo: string;
  vehicleClass: string;
  make: string;
  model: string;
  fuelType: string;
  manufacturingYear: string;
  capacity: string;
  chassisNo: string;
  engineNo: string;
  rtoState: string;
  rtoName: string;
  policyProduct: string;
  idv: string;
  od: string;
  tp: string;
  cpa: string;
  policyNo: string;
  insurerId: string;
  validFrom: string;
  validUpto: string;
};

export type OcrApplyInput = {
  mode: "create" | "edit";
  registrationMode: "registered" | "unregistered";
  current: OcrOperationalState;
  fields: OcrImportField[];
  manufacturers: string[];
  insurers: Array<{ value: string; label: string }>;
  rcVerified: boolean;
};

export type OcrApplyResult = {
  next: OcrOperationalState;
  registrationMode: "registered" | "unregistered";
  applied: number;
  skipped: string[];
  touchedSection02: boolean;
};

const SECTION_02 = new Set([
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(?:the|co|company|limited|ltd|general|insurance|motors?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function vehicleClass(raw: string) {
  const value = normalizeText(raw);
  if (/\bgcv\b|goods carrying|goods carrier|goods vehicle|truck|cargo/.test(value)) return "GCV";
  if (/\bpcv\b|passenger carrying|passenger vehicle|bus|taxi|cab/.test(value)) return "PCV";
  if (/\bpcp\b|private car|motor car|private vehicle/.test(value)) return "PCP";
  if (/\btwp\b|two wheeler|motor cycle|motorcycle|scooter/.test(value)) return "TWP";
  if (/\bcpm\b|contractor plant|contractors plant|mobile plant|construction equipment/.test(value)) return "CPM";
  if (/\bmisd\b|miscellaneous/.test(value)) return "MISD";
  return "";
}

function policyProductsForClass(classCode: string) {
  return classCode === "PCP" || classCode === "TWP"
    ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"]
    : ["Package", "Third Party", "SAOD"];
}

function policyProduct(raw: string, classCode: string) {
  const value = normalizeText(raw);
  const candidate = /standalone od|stand alone od|standalone own damage|stand alone own damage|\bsaod\b/.test(value) ? "SAOD"
    : /long term third party|multi year third party|long term liability/.test(value) ? "Long Term Third Party"
      : /long term package|multi year package/.test(value) ? "Long Term Package"
        : /bundled/.test(value) ? "Bundled"
          : /third party|liability only|act only/.test(value) ? "Third Party"
            : /package|comprehensive/.test(value) ? "Package"
              : "";
  return candidate && policyProductsForClass(classCode).includes(candidate) ? candidate : "";
}

function fuel(raw: string) {
  const value = raw.toUpperCase();
  if (value.includes("PETROL")) return "Petrol";
  if (value.includes("DIESEL")) return "Diesel";
  if (value.includes("CNG")) return "CNG";
  if (value.includes("ELECTRIC")) return "Electric";
  if (value.includes("HYBRID")) return "Hybrid";
  if (value.includes("BI-FUEL") || value.includes("BI FUEL")) return "Bi-Fuel";
  if (value.trim() === "OTHER") return "Other";
  return "";
}

function manufacturer(raw: string, options: string[]) {
  const wanted = normalizeText(raw);
  if (!wanted) return "";
  const exact = options.find((option) => normalizeText(option) === wanted);
  if (exact) return exact;
  const candidates = options.filter((option) => {
    const normalized = normalizeText(option);
    return normalized.length >= 3 && (wanted.includes(normalized) || normalized.includes(wanted));
  });
  return candidates.length === 1 ? candidates[0] : "";
}

function insurer(raw: string, options: Array<{ value: string; label: string }>) {
  const wanted = normalizeText(raw);
  if (!wanted) return "";
  const exact = options.find((option) => normalizeText(option.label) === wanted);
  if (exact) return exact.value;
  const wantedTokens = new Set(wanted.split(" ").filter(Boolean));
  let best: { value: string; score: number } | null = null;
  let tied = false;
  for (const option of options) {
    const normalized = normalizeText(option.label);
    const optionTokens = new Set(normalized.split(" ").filter(Boolean));
    if (!optionTokens.size) continue;
    const overlap = Array.from(wantedTokens).filter((token) => optionTokens.has(token)).length;
    const score = overlap / Math.max(wantedTokens.size, optionTokens.size, 1);
    if (!best || score > best.score) {
      best = { value: option.value, score };
      tied = false;
    } else if (best && score === best.score && score > 0) {
      tied = true;
    }
  }
  return best && best.score >= .5 && !tied ? best.value : "";
}

function amount(raw: string) {
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return "";
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? String(value) : "";
}

function year(raw: string) {
  const match = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return "";
  const value = Number(match[1]);
  const max = new Date().getFullYear() + 1;
  return value >= 1980 && value <= max ? String(value) : "";
}

function capacity(raw: string) {
  const match = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return "";
  const value = Number(match[0]);
  return Number.isFinite(value) && value >= 0 && value <= 100000 ? String(value) : "";
}

function vehicleIdentifier(raw: string) {
  const value = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (value.length < 5 || value.length > 40) return "";
  if (/^(VEHICLE|CHASSIS|ENGINE|NUMBER|AUTHORITY|MAKEMODEL)$/.test(value)) return "";
  return value;
}

function registration(raw: string) {
  const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}[A-Z0-9]*[0-9]{2}$/.test(value) ? value : "";
}

function policyNumber(raw: string) {
  const value = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (value.length < 4 || value.length > 80) return "";
  if (/^(POLICY|POLICY NUMBER|DOCUMENT|NUMBER)$/.test(value)) return "";
  return value;
}

function isoDate(raw: string) {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const months: Record<string, string> = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" };
  const named = value.toUpperCase().match(/(\d{1,2})[-/ ]([A-Z]{3})[-/ ](\d{4})/);
  if (named) return `${named[3]}-${months[named[2]] ?? ""}-${named[1].padStart(2, "0")}`;
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  return "";
}

export function buildPolicyOcrOnboardingUpdate(input: OcrApplyInput): OcrApplyResult {
  const byKey = new Map(input.fields.map((field) => [field.key, field]));
  const next = { ...input.current };
  const skipped: string[] = [];
  let applied = 0;
  let registrationMode = input.registrationMode;
  let touchedSection02 = false;
  const section02Protected = input.mode === "edit" || input.rcVerified;

  const skip = (key: string) => {
    const field = byKey.get(key);
    if (field) skipped.push(field.label);
  };
  const setText = (key: string, assign: (value: string) => void, normalize: (raw: string) => string = (raw) => raw.trim()) => {
    const field = byKey.get(key);
    if (!field) return;
    if (SECTION_02.has(key) && section02Protected) { skip(key); return; }
    const value = normalize(field.value);
    if (!value && value !== "0") { skip(key); return; }
    assign(value);
    applied += 1;
    if (SECTION_02.has(key)) touchedSection02 = true;
  };

  const registrationStatus = byKey.get("vehicle_registration_status");
  if (registrationStatus) {
    if (section02Protected) skip("vehicle_registration_status");
    else {
      registrationMode = /pending|unregistered|new vehicle/i.test(registrationStatus.value) ? "unregistered" : "registered";
      if (registrationMode === "unregistered") next.registrationNo = "";
      applied += 1;
      touchedSection02 = true;
    }
  }

  const registrationField = byKey.get("vehicle_registration_number");
  if (registrationField) {
    if (section02Protected || registrationMode === "unregistered") skip("vehicle_registration_number");
    else setText("vehicle_registration_number", (value) => { next.registrationNo = value; }, registration);
  }

  const classField = byKey.get("vehicle_class");
  if (classField) {
    if (section02Protected) skip("vehicle_class");
    else {
      const value = vehicleClass(classField.value);
      if (!value) skip("vehicle_class");
      else {
        const changed = next.vehicleClass !== value;
        next.vehicleClass = value;
        if (changed && !byKey.has("vehicle_capacity")) next.capacity = "";
        if (changed && !byKey.has("policy_product")) next.policyProduct = "";
        applied += 1;
        touchedSection02 = true;
      }
    }
  }

  setText("vehicle_make", (value) => { next.make = value; }, (raw) => manufacturer(raw, input.manufacturers));
  setText("vehicle_model", (value) => { next.model = value; }, (raw) => {
    const value = raw.trim();
    return value.length >= 2 && value.length <= 100 && !/^(MODEL|DESCRIPTION|FUEL TYPE)$/i.test(value) ? value : "";
  });
  setText("vehicle_fuel_type", (value) => { next.fuelType = value; }, fuel);
  setText("vehicle_manufacturing_year", (value) => { next.manufacturingYear = value; }, year);
  setText("vehicle_rto_state", (value) => { next.rtoState = value; });
  setText("vehicle_rto_name", (value) => { next.rtoName = value; });
  setText("vehicle_chassis_number", (value) => { next.chassisNo = value; }, vehicleIdentifier);
  setText("vehicle_engine_number", (value) => { next.engineNo = value; }, vehicleIdentifier);
  setText("vehicle_capacity", (value) => { next.capacity = value; }, capacity);

  setText("policy_product", (value) => { next.policyProduct = value; }, (raw) => policyProduct(raw, next.vehicleClass));
  setText("policy_number", (value) => { next.policyNo = value; }, policyNumber);
  setText("insurer_name", (value) => { next.insurerId = value; }, (raw) => insurer(raw, input.insurers));
  setText("idv", (value) => { next.idv = value; }, amount);
  setText("od_premium", (value) => { next.od = value; }, amount);
  setText("tp_premium", (value) => { next.tp = value; }, amount);
  // Historical cpa_premium can include paid-driver/workmen liability additions. The
  // amount may be imported, but cpaOpted is intentionally not changed here.
  setText("cpa_premium", (value) => { next.cpa = value; }, amount);
  setText("policy_start_date", (value) => { next.validFrom = value; }, isoDate);
  setText("policy_end_date", (value) => { next.validUpto = value; }, isoDate);

  if (next.policyProduct && !policyProductsForClass(next.vehicleClass).includes(next.policyProduct)) {
    next.policyProduct = "";
  }

  return { next, registrationMode, applied, skipped, touchedSection02 };
}
