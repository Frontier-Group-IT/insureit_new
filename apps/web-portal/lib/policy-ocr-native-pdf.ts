import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const MAX_NATIVE_PDF_PAGES = 12;
const MAX_NATIVE_TEXT_PAGES = 2;
const NATIVE_PDF_TIMEOUT_MS = 8_000;
const MAX_IMAGE_SIZE = 16_777_216;

const NEW_INDIA_ENHANCED = /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s?\-–—:]{0,12}ENHANCED\s+COVERS/i;
const YEAR_LABEL = /Year\s+of\s+manufacture\s*:?/i;
const COMBINED_LABEL = /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?\s*:?/i;

export type NativePdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
};

export type NativePdfTextRow = {
  y: number;
  items: NativePdfTextItem[];
};

export type NativePdfTextPage = {
  text: string;
  rows: NativePdfTextRow[];
};

export async function extractNativePdfTextPages(bytes: Uint8Array): Promise<NativePdfTextPage[]> {
  if (!bytes.byteLength) return [];

  return withTimeout(async () => {
    const { getDocumentProxy } = await import("unpdf");
    const document = await getDocumentProxy(bytes, {
      disableFontFace: true,
      maxImageSize: MAX_IMAGE_SIZE,
    });

    try {
      if (document.numPages < 1 || document.numPages > MAX_NATIVE_PDF_PAGES) return [];
      const pages: NativePdfTextPage[] = [];
      for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, MAX_NATIVE_TEXT_PAGES); pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          const rows = buildRows(content.items as unknown[]);
          const text = rows.map((row) => row.items.map((item) => item.text).join(" ")).join("\n").trim();
          pages.push({ text, rows });
        } finally {
          page.cleanup();
        }
      }
      return pages;
    } finally {
      const destroy = (document as unknown as { destroy?: () => void | Promise<void> }).destroy;
      if (typeof destroy === "function") await destroy.call(document);
    }
  }, NATIVE_PDF_TIMEOUT_MS);
}

export function refineNewIndiaNativePdfVehicleEvidence(
  nativePages: NativePdfTextPage[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "new_india_motor_v1" || !nativePages.length) return parsed;
  const firstTwo = nativePages.slice(0, 2).map((page) => page.text).join("\n");
  const alreadyEnhanced = /new-india-enhanced-covers/i.test(parsed.parserVersion);
  if (!alreadyEnhanced && !NEW_INDIA_ENHANCED.test(firstTwo)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const before = targetPresence(fields);
  const firstPageRows = nativePages[0]?.rows ?? [];

  if (!before.manufacturingYear) {
    const year = findExplicitYear(firstPageRows);
    if (year) set(fields, "vehicle_manufacturing_year", "Manufacturing year", year, "Native PDF Vehicle Details row");
  }

  if (!before.chassis || !before.engine) {
    const pair = findExplicitIdentifierPair(firstPageRows);
    if (pair) {
      if (!before.chassis) set(fields, "vehicle_chassis_number", "Chassis number", pair.chassis, "Native PDF Chassis/Engine row");
      if (!before.engine) set(fields, "vehicle_engine_number", "Engine number", pair.engine, "Native PDF Chassis/Engine row");
    }
  }

  const after = targetPresence(fields);
  const changed = after.manufacturingYear !== before.manufacturingYear
    || after.chassis !== before.chassis
    || after.engine !== before.engine;

  if (!changed) return parsed;
  const suffix = "+new-india-native-pdf-vehicle-v1";
  return {
    ...parsed,
    parserVersion: parsed.parserVersion.includes(suffix) ? parsed.parserVersion : `${parsed.parserVersion}${suffix}`,
    fields: [...fields.values()],
  };
}

export function summarizeNativePdfVehicleEvidence(nativePages: NativePdfTextPage[], parsed: ParsedPolicyResult) {
  const rows = nativePages[0]?.rows ?? [];
  const pair = findExplicitIdentifierPair(rows);
  const year = findExplicitYear(rows);
  return {
    nativePages: nativePages.length,
    hasYearLabelRow: rows.some((row) => YEAR_LABEL.test(rowText(row))),
    hasChassisEngineLabelRow: rows.some((row) => COMBINED_LABEL.test(rowText(row))),
    explicitYearRecovered: Boolean(year),
    explicitPairRecovered: Boolean(pair),
    manufacturingYearPresent: Boolean(parsed.fields.find((field) => field.key === "vehicle_manufacturing_year")?.value?.trim()),
    chassisPresent: Boolean(parsed.fields.find((field) => field.key === "vehicle_chassis_number")?.value?.trim()),
    enginePresent: Boolean(parsed.fields.find((field) => field.key === "vehicle_engine_number")?.value?.trim()),
  };
}

function findExplicitYear(rows: NativePdfTextRow[]) {
  const hits = new Set<string>();
  for (const row of rows) {
    const text = rowText(row);
    const label = YEAR_LABEL.exec(text);
    if (!label || label.index == null) continue;
    const after = text.slice(label.index + label[0].length);
    const year = after.match(/\b((?:19|20)\d{2})\b/)?.[1];
    if (year) hits.add(year);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

function findExplicitIdentifierPair(rows: NativePdfTextRow[]) {
  const pairs = new Map<string, { chassis: string; engine: string }>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowTextValue = rowText(row);
    if (!COMBINED_LABEL.test(rowTextValue)) continue;
    const labelItem = row.items.find((item) => COMBINED_LABEL.test(item.text));
    const labelX = labelItem?.x ?? approximateLabelX(row);
    const sameRowText = row.items
      .filter((item) => item.x >= labelX - 2)
      .map((item) => item.text)
      .join(" ");
    const direct = parsePairWithContinuation(sameRowText, rows, index, labelX);
    if (direct) pairs.set(`${direct.chassis}|${direct.engine}`, direct);
  }

  return pairs.size === 1 ? [...pairs.values()][0] : null;
}

function parsePairWithContinuation(text: string, rows: NativePdfTextRow[], rowIndex: number, labelX: number) {
  const withoutLabel = text.replace(COMBINED_LABEL, " ").trim().toUpperCase();
  const slash = withoutLabel.indexOf("/");
  if (slash < 0) return null;

  const left = compactId(withoutLabel.slice(0, slash));
  let right = compactId(withoutLabel.slice(slash + 1));
  if (!validId(left)) return null;

  if (!looksLikeChassis(right)) {
    const continuations: string[] = [];
    for (let offset = 1; offset <= 2 && rowIndex + offset < rows.length; offset += 1) {
      for (const item of rows[rowIndex + offset].items) {
        if (item.x < labelX - 2) continue;
        const candidate = compactId(item.text);
        if (!candidate || candidate.length > 17) continue;
        if (looksLikeChassis(`${right}${candidate}`)) continuations.push(candidate);
      }
    }
    const unique = [...new Set(continuations)];
    if (unique.length === 1) right = `${right}${unique[0]}`;
  }

  if (!validId(right) || left === right) return null;
  if (looksLikeChassis(left) && !looksLikeChassis(right)) return { chassis: left, engine: right };
  if (looksLikeChassis(right) && !looksLikeChassis(left)) return { chassis: right, engine: left };
  return null;
}

function buildRows(items: unknown[]) {
  const rows: NativePdfTextRow[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { str?: unknown; transform?: unknown; width?: unknown };
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const x = Number(item.transform[4]);
    const y = Number(item.transform[5]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const width = Number(item.width ?? 0);
    const textItem: NativePdfTextItem = {
      text: item.str.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
      x,
      y,
      width: Number.isFinite(width) ? width : 0,
    };
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(textItem);
  }

  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

function approximateLabelX(row: NativePdfTextRow) {
  const text = rowText(row);
  const index = text.search(COMBINED_LABEL);
  if (index < 0) return row.items[0]?.x ?? 0;
  let characters = 0;
  for (const item of row.items) {
    const next = characters + item.text.length + 1;
    if (index < next) return item.x;
    characters = next;
  }
  return row.items[0]?.x ?? 0;
}

function rowText(row: NativePdfTextRow) {
  return row.items.map((item) => item.text).join(" ");
}

function targetPresence(fields: Map<string, ParsedPolicyField>) {
  return {
    manufacturingYear: Boolean(fields.get("vehicle_manufacturing_year")?.value?.trim()),
    chassis: Boolean(fields.get("vehicle_chassis_number")?.value?.trim()),
    engine: Boolean(fields.get("vehicle_engine_number")?.value?.trim()),
  };
}

function looksLikeChassis(value: string) {
  return value.length === 17 && /^[A-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}

function validId(value: string) {
  return value.length >= 10 && value.length <= 24 && /[A-Z]/.test(value) && /\d/.test(value);
}

function compactId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function set(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, evidence: string) {
  fields.set(key, { key, label, value, confidence: 0.995, page: 1, evidence });
}

async function withTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("native_pdf_text_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
