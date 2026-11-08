import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const helper = readFileSync(resolve(root, "lib/policy-ocr-layout-mode.ts"), "utf8");
const main = readFileSync(resolve(root, "app/policies/policy-ocr-actions.ts"), "utf8");
const intake = readFileSync(resolve(root, "lib/policy-intake-ocr-service.ts"), "utf8");

assert.match(helper, /mimeType === "application\\/pdf" && process\\.env\\.POLICY_OCR_LAYOUT_PARSER_ENABLED === "true"/,
  "Only explicit opt-in can enable billable Layout Parser calls");
for (const [name, source] of [["main and training", main], ["policy intake and retries", intake]]) {
  assert.match(source, /import \\{ shouldRunPolicyOcrLayoutParser \\} from "@\\/lib\\/policy-ocr-layout-mode"/,
    `${name} must use shared toggle`);
  assert.match(source, /shouldRunPolicyOcrLayoutParser\\(file\\.type\\)/,
    `${name} must guard Layout Parser invocation`);
  assert.doesNotMatch(source, /file\\.type === "application\\/pdf"\\s*\\? await (?:processLayoutTables|layoutTables)/,
    `${name} must not bypass the opt-in toggle`);
}
console.log("OCR-only Layout Parser toggle regression passed");
