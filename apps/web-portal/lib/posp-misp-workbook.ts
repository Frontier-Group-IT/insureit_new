import { unzipSync } from "fflate";
import { readSheet, type CellValue, type SheetData } from "read-excel-file/node";

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 250;
const MAX_EXPANDED_BYTES = 40 * 1024 * 1024;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_ROWS = 5000;
const MAX_COLUMNS = 80;
const MAX_CELL_CHARACTERS = 5000;
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ALLOWED_MIME_TYPES = new Set(["", XLSX_MIME_TYPE, "application/octet-stream"]);
const REQUIRED_SHEETS = ["POSP", "MISP"] as const;

export type ImportSheetName = (typeof REQUIRED_SHEETS)[number];

export type ParsedImportSheet = {
  name: ImportSheetName;
  rows: Array<Record<string, unknown>>;
};

export class WorkbookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookValidationError";
  }
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function assertWorkbookFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new WorkbookValidationError("Upload an .xlsx workbook. Legacy .xls and macro-enabled files are not supported.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new WorkbookValidationError("The selected file is not a valid .xlsx workbook.");
  }
  if (file.size > MAX_WORKBOOK_BYTES) {
    throw new WorkbookValidationError("The workbook must be 5 MB or smaller.");
  }
}

function inspectArchive(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new WorkbookValidationError("The selected file is not a valid .xlsx workbook.");
  }

  let entryCount = 0;
  let expandedBytes = 0;
  const entryNames = new Set<string>();
  let selectedEntries: Record<string, Uint8Array>;

  try {
    selectedEntries = unzipSync(bytes, {
      filter(entry) {
        entryCount += 1;
        expandedBytes += entry.originalSize;
        const normalizedName = entry.name.replaceAll("\\", "/").toLowerCase();
        entryNames.add(normalizedName);

        if (entryCount > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_EXPANDED_BYTES || entry.originalSize > MAX_ENTRY_BYTES) {
          throw new WorkbookValidationError("The workbook is too complex to import safely.");
        }

        return normalizedName === "xl/workbook.xml"
          || normalizedName === "[content_types].xml"
          || normalizedName.startsWith("xl/worksheets/")
          || normalizedName.startsWith("xl/externallinks/");
      }
    });
  } catch (error) {
    if (error instanceof WorkbookValidationError) throw error;
    throw new WorkbookValidationError("The workbook is damaged or could not be read.");
  }

  if (entryNames.has("xl/vbaproject.bin") || entryNames.has("xl/vbaprojectsignature.bin")) {
    throw new WorkbookValidationError("Macro-enabled workbooks are not accepted.");
  }
  if ([...entryNames].some((name) => name.startsWith("xl/externallinks/"))) {
    throw new WorkbookValidationError("Remove external workbook links before uploading this file.");
  }
  if ([...entryNames].some((name) => name.includes("../") || name.startsWith("/"))) {
    throw new WorkbookValidationError("The workbook contains an unsafe archive path.");
  }

  const decoder = new TextDecoder("utf-8");
  for (const [name, content] of Object.entries(selectedEntries)) {
    const normalizedName = name.replaceAll("\\", "/").toLowerCase();
    if (normalizedName.startsWith("xl/worksheets/") && /<f(?:\s|>)/i.test(decoder.decode(content))) {
      throw new WorkbookValidationError("Formulas are not accepted. Replace formulas with their displayed values before uploading.");
    }
  }

  const workbookEntry = Object.entries(selectedEntries).find(
    ([name]) => name.replaceAll("\\", "/").toLowerCase() === "xl/workbook.xml"
  );
  if (!workbookEntry) throw new WorkbookValidationError("The workbook does not contain readable sheets.");

  const workbookXml = decoder.decode(workbookEntry[1]);
  const names = [...workbookXml.matchAll(/<sheet\b[^>]*\bname=(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => decodeXmlEntities(match[1] ?? match[2] ?? ""))
    .filter(Boolean);

  return names;
}

function assertCellWithinLimit(value: CellValue, rowNumber: number, columnNumber: number) {
  if (typeof value === "string" && value.length > MAX_CELL_CHARACTERS) {
    throw new WorkbookValidationError(
      `Cell ${columnNumber} in row ${rowNumber} is too long. Keep each cell below ${MAX_CELL_CHARACTERS} characters.`
    );
  }
}

function sheetRowsToRecords(data: SheetData, sheetName: ImportSheetName) {
  if (!data.length) return [];
  const [headerRow, ...bodyRows] = data;
  if (headerRow.length > MAX_COLUMNS) {
    throw new WorkbookValidationError(`${sheetName} has more than ${MAX_COLUMNS} columns.`);
  }

  const headerCounts = new Map<string, number>();
  const headers = headerRow.map((value, columnIndex) => {
    if (value !== null) assertCellWithinLimit(value, 1, columnIndex + 1);
    const header = String(value ?? "").trim();
    if (!header) return "";
    const occurrence = headerCounts.get(header) ?? 0;
    headerCounts.set(header, occurrence + 1);
    return occurrence === 0 ? header : `${header}_${occurrence}`;
  });

  return bodyRows.flatMap((row, index) => {
    const rowNumber = index + 2;
    if (row.length > MAX_COLUMNS) {
      throw new WorkbookValidationError(`${sheetName} row ${rowNumber} has more than ${MAX_COLUMNS} columns.`);
    }
    row.forEach((value, columnIndex) => {
      if (value !== null) assertCellWithinLimit(value, rowNumber, columnIndex + 1);
    });
    if (!row.some((value) => value !== null && String(value).trim())) return [];

    const record: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      if (header) record[header] = row[columnIndex] ?? null;
    });
    return [record];
  });
}

export async function parsePospMispWorkbook(file: File): Promise<ParsedImportSheet[]> {
  assertWorkbookFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sheetNames = inspectArchive(bytes);
  const selectedSheets = REQUIRED_SHEETS.flatMap((requiredName) => {
    const actualName = sheetNames.find((name) => name.trim().toUpperCase() === requiredName);
    return actualName ? [{ requiredName, actualName }] : [];
  });

  if (!selectedSheets.length) {
    throw new WorkbookValidationError("The workbook must contain a POSP or MISP sheet.");
  }

  let totalRows = 0;
  const parsedSheets: ParsedImportSheet[] = [];
  for (const sheet of selectedSheets) {
    let data: SheetData;
    try {
      data = await readSheet(Buffer.from(bytes), sheet.actualName);
    } catch {
      throw new WorkbookValidationError(`${sheet.requiredName} could not be read. Check the sheet and upload the workbook again.`);
    }
    const rows = sheetRowsToRecords(data, sheet.requiredName);
    totalRows += rows.length;
    if (totalRows > MAX_TOTAL_ROWS) {
      throw new WorkbookValidationError(`POSP and MISP sheets can contain at most ${MAX_TOTAL_ROWS} data rows combined.`);
    }
    parsedSheets.push({ name: sheet.requiredName, rows });
  }

  return parsedSheets;
}
