import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
// @ts-expect-error -- raw Node OCR regression requires explicit TypeScript extension.
import { extractNativePdfTextPages, refineIciciNativePdfEvidence } from "../lib/policy-ocr-native-pdf.ts";

const ENGINE = "ENGTEST90012345";
const CHASSIS = "TESTVIN12ABC34567";

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const page1 = pdf.addPage([842, 595]);
const draw1 = (text: string, x: number, y: number) => page1.drawText(text, { x, y, size: 10, font });

draw1("ICICI Lombard General Insurance Company Limited", 35, 560);
draw1("Product Code: 3003", 35, 542);
draw1("Goods Carrying Vehicles Package Policy", 35, 524);
draw1("Vehicle Registration Date", 35, 470);
draw1("Engine No.", 280, 470);
draw1("Chassis No.", 500, 470);
draw1("Sep 28, 2024", 35, 450);
draw1(ENGINE, 280, 450);
draw1(CHASSIS, 500, 450);

const page2 = pdf.addPage([842, 595]);
const draw2 = (text: string, x: number, y: number) => page2.drawText(text, { x, y, size: 10, font });
draw2("ICICI Lombard General Insurance Company Limited", 35, 560);
draw2("Goods Carrying Vehicles Package Policy", 35, 542);
draw2("Body IDV (₹)", 35, 450);
draw2("Chassis IDV (₹)", 200, 450);
draw2("Total IDV (₹)", 430, 450);
draw2("10,00,000.00", 35, 430);
draw2("25,00,000.00", 200, 430);
draw2("35,00,000.00", 430, 430);

const bytes = await pdf.save();
const nativePages = await extractNativePdfTextPages(bytes);
assert.equal(nativePages.length, 2);

const parsed = {
  parserId: "icici_lombard_motor_v1",
  parserVersion: "icici_lombard_motor_v1.9.0+gcv-live-replay-v10",
  fields: [
    { key: "vehicle_engine_number", label: "Engine number", value: "", confidence: 0.5, page: 1, evidence: "missing" },
    { key: "vehicle_chassis_number", label: "Chassis number", value: "", confidence: 0.5, page: 1, evidence: "missing" },
    { key: "idv", label: "IDV / Sum insured", value: "2500000", confidence: 0.99, page: 2, evidence: "shifted Chassis IDV" },
  ],
  warnings: [],
};

const refined = refineIciciNativePdfEvidence(nativePages, parsed);
const field = (key: string) => refined.fields.find((entry) => entry.key === key)?.value;

assert.equal(field("vehicle_engine_number"), ENGINE);
assert.equal(field("vehicle_chassis_number"), CHASSIS);
assert.equal(field("idv"), "3500000");
assert.match(refined.parserVersion, /icici-native-pdf-evidence-v1/);

const noEvidence = refineIciciNativePdfEvidence([], parsed);
assert.equal(noEvidence, parsed);

const unrelated = refineIciciNativePdfEvidence(nativePages, {
  ...parsed,
  parserId: "digit_commercial_motor_v1",
});
assert.equal(unrelated.parserId, "digit_commercial_motor_v1");
assert.equal(unrelated.fields.find((entry) => entry.key === "idv")?.value, "2500000");

console.log("ICICI native PDF evidence regression passed.");
