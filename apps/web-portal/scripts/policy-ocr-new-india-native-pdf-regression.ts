import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { extractNativePdfTextPages, refineNewIndiaNativePdfVehicleEvidence } from "../lib/policy-ocr-native-pdf.ts";

const pdf = await PDFDocument.create();
const page = pdf.addPage([842, 595]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const draw = (text: string, x: number, y: number) => page.drawText(text, { x, y, size: 10, font });

draw("THE NEW INDIA ASSURANCE CO. LTD.", 35, 560);
draw("Commercial Vehicle Package Policy - Enhanced Covers", 35, 542);
draw("VEHICLE DETAILS", 35, 500);
draw("Geographical Area / Zone:", 35, 480);
draw("India/C", 170, 480);
draw("Year of manufacture:", 420, 480);
draw("2026", 560, 480);
draw("Name of the Financier:", 35, 450);
draw("SYNTHETIC FINANCE COMPANY", 170, 450);
draw("Chassis no./Engine no.:", 420, 450);
draw("ENG9TEST001234/MEC881", 560, 450);
draw("HCGTP207105", 560, 435);
draw("Type of fuel:", 35, 410);
draw("Diesel", 170, 410);

const bytes = await pdf.save();
const nativePages = await extractNativePdfTextPages(bytes);
assert.equal(nativePages.length, 1);
assert.match(nativePages[0].text, /Year of manufacture/i);
assert.match(nativePages[0].text, /Chassis no\.\/Engine no\./i);

const parsed = {
  parserId: "new_india_motor_v1",
  parserVersion: "new_india_commercial_motor_v1.3.3+new-india-enhanced-covers-v1+new-india-separated-vehicle-evidence-v6",
  fields: [
    { key: "insurance_company", label: "Insurance company", value: "The New India Assurance Company Limited", confidence: 0.99, page: 1, evidence: "synthetic" },
  ],
  warnings: [],
};

const refined = refineNewIndiaNativePdfVehicleEvidence(nativePages, parsed);
const field = (key: string) => refined.fields.find((entry) => entry.key === key)?.value;
assert.equal(field("vehicle_manufacturing_year"), "2026");
assert.equal(field("vehicle_chassis_number"), "MEC881HCGTP207105");
assert.equal(field("vehicle_engine_number"), "ENG9TEST001234");
assert.match(refined.parserVersion, /new-india-native-pdf-vehicle-v1/);

const noEvidence = refineNewIndiaNativePdfVehicleEvidence([], parsed);
assert.equal(noEvidence, parsed, "scanned/image-equivalent input without native text must remain unchanged");

const ambiguousPages = nativePages.map((entry) => ({
  ...entry,
  rows: entry.rows.map((row) => ({ ...row, items: [...row.items] })),
}));
const targetRow = ambiguousPages[0].rows.find((row) => row.items.some((item) => /Chassis no\.\/Engine no\./i.test(item.text)));
assert.ok(targetRow);
targetRow.items.push({ text: "REFERENCE9X12345", x: 700, y: targetRow.y, width: 70 });
const ambiguous = refineNewIndiaNativePdfVehicleEvidence(ambiguousPages, parsed);
assert.equal(ambiguous.fields.find((entry) => entry.key === "vehicle_chassis_number")?.value, undefined);
assert.equal(ambiguous.fields.find((entry) => entry.key === "vehicle_engine_number")?.value, undefined);

console.log("New India native PDF vehicle evidence regression passed.");
