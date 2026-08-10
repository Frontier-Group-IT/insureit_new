import { unzipSync } from "fflate";
import { readSheet, type CellValue, type SheetData } from "read-excel-file/node";
import {
  ASSISTANT_KNOWLEDGE_HEADERS,
  ASSISTANT_METADATA_HEADERS,
  ASSISTANT_WORKBOOK_SHEETS,
  AssistantKnowledgeValidationError,
  type AssistantKnowledgeEntry,
  type AssistantKnowledgeMetadata,
  validateAssistantKnowledgeRow,
  validateAssistantMetadata,
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
} from "./knowledge-schema.ts";

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 250;
const MAX_EXPANDED_BYTES = 40 * 1024 * 1024;
const MAX_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_KNOWLEDGE_ROWS = 1_000;
const MAX_CELL_CHARACTERS = 12_000;
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ALLOWED_MIME_TYPES = new Set(["", XLSX_MIME_TYPE, "application/octet-stream"]);

type AssistantWorkbook = { metadata: AssistantKnowledgeMetadata; entries: AssistantKnowledgeEntry[] };

export class AssistantWorkbookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistantWorkbookValidationError";
  }
}

function decodeXmlEntities(value: string) {
  return value.replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function assertWorkbookFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new AssistantWorkbookValidationError("Upload an .xlsx workbook. Legacy .xls and macro-enabled files are not supported.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) throw new AssistantWorkbookValidationError("The selected file is not a valid .xlsx workbook.");
  if (file.size > MAX_WORKBOOK_BYTES) throw new AssistantWorkbookValidationError("The workbook must be 5 MB or smaller.");
}

function inspectArchive(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new AssistantWorkbookValidationError("The selected file is not a valid .xlsx workbook.");
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
        const name = entry.name.replaceAll("\\", "/").toLowerCase();
        entryNames.add(name);
        if (entryCount > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_EXPANDED_BYTES || entry.originalSize > MAX_ENTRY_BYTES) {
          throw new AssistantWorkbookValidationError("The workbook is too complex to import safely.");
        }
        return name === "xl/workbook.xml" || name.startsWith("xl/worksheets/") || name.endsWith(".rels");
      },
    });
  } catch (error) {
    if (error instanceof AssistantWorkbookValidationError) throw error;
    throw new AssistantWorkbookValidationError("The workbook is damaged or could not be read.");
  }
  if (entryNames.has("xl/vbaproject.bin") || entryNames.has("xl/vbaprojectsignature.bin")) {
    throw new AssistantWorkbookValidationError("Macro-enabled workbooks are not accepted.");
  }
  if ([...entryNames].some((name) => name.startsWith("xl/externallinks/"))) {
    throw new AssistantWorkbookValidationError("Remove external workbook links before uploading this file.");
  }
  if ([...entryNames].some((name) => name.includes("../") || name.startsWith("/"))) {
    throw new AssistantWorkbookValidationError("The workbook contains an unsafe archive path.");
  }
  const decoder = new TextDecoder("utf-8");
  for (const [name, content] of Object.entries(selectedEntries)) {
    const xml = decoder.decode(content);
    const normalizedName = name.replaceAll("\\", "/").toLowerCase();
    if (normalizedName.startsWith("xl/worksheets/") && /<f(?:\s|>)/i.test(xml)) {
      throw new AssistantWorkbookValidationError("Formulas are not accepted. Replace formulas with displayed values before uploading.");
    }
    if (normalizedName.endsWith(".rels") && /TargetMode\s*=\s*["']External["']/i.test(xml)) {
      throw new AssistantWorkbookValidationError("Remove external links before uploading this file.");
    }
  }
  const workbookEntry = Object.entries(selectedEntries).find(([name]) => name.replaceAll("\\", "/").toLowerCase() === "xl/workbook.xml");
  if (!workbookEntry) throw new AssistantWorkbookValidationError("The workbook is missing its workbook definition.");
  const workbookXml = decoder.decode(workbookEntry[1]);
  if (/<sheet\b[^>]*\bstate\s*=\s*["'](?:hidden|veryHidden)["']/i.test(workbookXml)) {
    throw new AssistantWorkbookValidationError("Hidden or very hidden sheets are not accepted.");
  }
  const sheetNames = Array.from(workbookXml.matchAll(/<sheet\b[^>]*\bname\s*=\s*["']([^"']+)["']/gi), (match) => decodeXmlEntities(match[1]));
  if (sheetNames.length !== ASSISTANT_WORKBOOK_SHEETS.length || ASSISTANT_WORKBOOK_SHEETS.some((name, index) => sheetNames[index] !== name)) {
    throw new AssistantWorkbookValidationError("The workbook must contain exactly the Metadata and Knowledge sheets in that order, with no hidden or unexpected sheets.");
  }
}

function assertCell(value: CellValue, row: number, column: number) {
  if (typeof value === "string" && value.length > MAX_CELL_CHARACTERS) {
    throw new AssistantWorkbookValidationError(`Cell ${column} in row ${row} exceeds ${MAX_CELL_CHARACTERS} characters.`);
  }
}

function rowsToRecords(data: SheetData, expectedHeaders: readonly string[], sheet: string) {
  if (!data.length) throw new AssistantWorkbookValidationError(`${sheet} is empty.`);
  const [headerRow, ...rows] = data;
  const headers = headerRow.map((value) => String(value ?? "").trim());
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
    throw new AssistantWorkbookValidationError(`${sheet} headers must be exactly: ${expectedHeaders.join(", ")}.`);
  }
  return rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    if (row.length > expectedHeaders.length) throw new AssistantWorkbookValidationError(`${sheet} row ${rowNumber} contains unexpected columns.`);
    row.forEach((value, column) => value !== null && assertCell(value, rowNumber, column + 1));
    if (!row.some((value) => value !== null && String(value).trim())) return [];
    return [Object.fromEntries(expectedHeaders.map((header, column) => [header, row[column] ?? null]))];
  });
}

export async function parseAssistantKnowledgeWorkbook(file: File): Promise<AssistantWorkbook> {
  assertWorkbookFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  inspectArchive(bytes);
  let metadataData: SheetData;
  let knowledgeData: SheetData;
  try {
    metadataData = await readSheet(Buffer.from(bytes), "Metadata");
    knowledgeData = await readSheet(Buffer.from(bytes), "Knowledge");
  } catch {
    throw new AssistantWorkbookValidationError("The controlled workbook sheets could not be read.");
  }
  const metadataRows = rowsToRecords(metadataData, ASSISTANT_METADATA_HEADERS, "Metadata");
  const knowledgeRows = rowsToRecords(knowledgeData, ASSISTANT_KNOWLEDGE_HEADERS, "Knowledge");
  if (!knowledgeRows.length) throw new AssistantWorkbookValidationError("Knowledge must contain at least one data row.");
  if (knowledgeRows.length > MAX_KNOWLEDGE_ROWS) throw new AssistantWorkbookValidationError(`Knowledge may contain at most ${MAX_KNOWLEDGE_ROWS} rows.`);
  try {
    return {
      metadata: validateAssistantMetadata(metadataRows),
      entries: knowledgeRows.map((row, index) => validateAssistantKnowledgeRow(row, index + 2)),
    };
  } catch (error) {
    if (error instanceof AssistantKnowledgeValidationError) throw new AssistantWorkbookValidationError(error.message);
    throw error;
  }
}
