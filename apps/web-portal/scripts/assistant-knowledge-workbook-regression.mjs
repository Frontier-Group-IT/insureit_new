import * as XLSX from "xlsx";
import { unzipSync, zipSync } from "fflate";
import {
  AssistantWorkbookValidationError,
  parseAssistantKnowledgeWorkbook,
} from "../lib/assistant/knowledge-workbook.ts";

function fail(message) {
  throw new Error(`[assistant-knowledge-workbook] ${message}`);
}
function workbookFile({ extraSheet = false, hiddenKnowledge = false, formula = false, fileName = "assistant.xlsx" } = {}) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Key", "Value"],
    ["template_version", "1"],
    ["content_version", "1"],
    ["knowledge_base_name", "Operations"],
    ["owner", "IT"],
    ["classification", "internal"],
  ]), "Metadata");
  const knowledge = XLSX.utils.aoa_to_sheet([
    ["Route", "Title", "Content", "Tags", "Source Reference", "Required Capabilities", "Minimum Access"],
    ["/claims/intake", "Claim intake", "Follow the approved claim intake checklist.", "claims, intake", "SOP-CLAIMS-01", "view_claims", "view"],
  ]);
  if (formula) knowledge.A2 = { t: "s", f: "HYPERLINK(\"https://evil.example\")", v: "/claims/intake" };
  XLSX.utils.book_append_sheet(workbook, knowledge, "Knowledge");
  if (extraSheet) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["unexpected"]]), "Extra");
  if (hiddenKnowledge) {
    workbook.Workbook ??= {};
    workbook.Workbook.Sheets = [{ Hidden: 0 }, { Hidden: 1 }];
  }
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
  return new File([bytes], fileName, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
async function expectReject(name, file, fragment) {
  try {
    await parseAssistantKnowledgeWorkbook(file);
  } catch (error) {
    if (error instanceof AssistantWorkbookValidationError && error.message.toLowerCase().includes(fragment)) return;
    fail(`${name} rejected for the wrong reason: ${error instanceof Error ? error.message : String(error)}`);
  }
  fail(`${name} was accepted`);
}
function injectEntry(file, name, content = "<x/>") {
  return file.arrayBuffer().then((buffer) => {
    const entries = unzipSync(new Uint8Array(buffer));
    entries[name] = new TextEncoder().encode(content);
    const bytes = zipSync(entries);
    return new File([bytes], "assistant.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  });
}

const parsed = await parseAssistantKnowledgeWorkbook(workbookFile());
if (parsed.metadata.knowledgeBaseName !== "Operations" || parsed.metadata.contentVersion !== 1 || parsed.entries.length !== 1 || parsed.entries[0].route !== "/claims/intake" || parsed.entries[0].requiredCapabilities[0] !== "view_claims" || parsed.entries[0].requiredAccess !== "view") {
  fail("valid controlled workbook did not parse");
}
await expectReject("unexpected sheet", workbookFile({ extraSheet: true }), "exactly the metadata and knowledge sheets");
await expectReject("hidden sheet", workbookFile({ hiddenKnowledge: true }), "hidden");
await expectReject("formula", workbookFile({ formula: true }), "formula");
await expectReject("macro extension", workbookFile({ fileName: "assistant.xlsm" }), ".xlsx");
await expectReject("external link", await injectEntry(workbookFile(), "xl/externalLinks/externalLink1.xml"), "external");
await expectReject("unsafe archive route", await injectEntry(workbookFile(), "../evil.xml"), "unsafe archive path");

console.log(JSON.stringify({ parsedEntries: 1, rejectedWorkbookThreatCases: 6, sheets: ["Metadata", "Knowledge"], status: "ok" }, null, 2));
