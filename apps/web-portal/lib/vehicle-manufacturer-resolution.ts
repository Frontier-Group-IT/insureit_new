export type VehicleManufacturerResolution = {
  value: string;
  method: "exact" | "normalized" | "contained";
};

const LEGAL_SUFFIXES = new Set([
  "CO",
  "COMPANY",
  "CORPORATION",
  "CORP",
  "INDIA",
  "LLP",
  "LTD",
  "LIMITED",
  "PVT",
  "PRIVATE",
]);

function normalizedWords(value: string) {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function canonicalWords(value: string) {
  const words = normalizedWords(value).filter((word) => !LEGAL_SUFFIXES.has(word));
  return words.length ? words : normalizedWords(value);
}

function normalizedKey(value: string) {
  return canonicalWords(value).join(" ");
}

function uniqueWords(value: string) {
  return Array.from(new Set(canonicalWords(value)));
}

function isSubset(smaller: string[], larger: string[]) {
  const largeSet = new Set(larger);
  return smaller.every((word) => largeSet.has(word));
}

export function resolveVehicleManufacturer(
  rawValue: string | null | undefined,
  options: string[],
): VehicleManufacturerResolution | null {
  const raw = rawValue?.trim();
  if (!raw) return null;

  const uniqueOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  const exact = uniqueOptions.find((option) => option.localeCompare(raw, undefined, { sensitivity: "accent" }) === 0);
  if (exact) return { value: exact, method: "exact" };

  const rawKey = normalizedKey(raw);
  if (!rawKey) return null;

  const normalizedMatches = uniqueOptions.filter((option) => normalizedKey(option) === rawKey);
  if (normalizedMatches.length === 1) return { value: normalizedMatches[0], method: "normalized" };

  const rawWords = uniqueWords(raw);
  const containedMatches = uniqueOptions.filter((option) => {
    const optionWords = uniqueWords(option);
    if (!optionWords.length || !rawWords.length) return false;
    if (optionWords.length === 1) return rawWords.includes(optionWords[0]);
    return isSubset(optionWords, rawWords) || isSubset(rawWords, optionWords);
  });

  if (containedMatches.length === 1) return { value: containedMatches[0], method: "contained" };
  return null;
}
