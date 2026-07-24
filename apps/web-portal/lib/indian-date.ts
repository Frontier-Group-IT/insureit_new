const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INDIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function validDate(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export function parseIndianDate(value?: string | null) {
  const match = value?.trim().match(INDIAN_DATE);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!validDate(year, month, day)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function formatIndianDate(value?: string | null) {
  if (!value) return "";
  const iso = value.trim().match(ISO_DATE);
  if (iso && validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const indian = value.trim().match(INDIAN_DATE);
  return indian && validDate(Number(indian[3]), Number(indian[2]), Number(indian[1]))
    ? value.trim()
    : "";
}

export function maskIndianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function normalizeImportedDate(value: unknown, options?: { ambiguousExcelDatesAreDayFirst?: boolean }) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (options?.ambiguousExcelDatesAreDayFirst) {
      const excelMonth = value.getUTCMonth() + 1;
      const excelDay = value.getUTCDate();
      if (excelDay <= 12) {
        return `${value.getUTCFullYear()}-${String(excelDay).padStart(2, "0")}-${String(excelMonth).padStart(2, "0")}`;
      }
    }
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) return null;
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replaceAll("'", "");
  if (!trimmed) return null;
  const indian = trimmed.match(/^(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{4})$/);
  if (indian) {
    const day = Number(indian[1]);
    const month = Number(indian[2]);
    const year = Number(indian[3]);
    if (!validDate(year, month, day)) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const iso = trimmed.match(ISO_DATE);
  if (iso && validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return trimmed;
  return null;
}
