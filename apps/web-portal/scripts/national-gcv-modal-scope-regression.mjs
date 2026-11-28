import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ui=readFileSync(new URL("../components/development/semi-auto-policy-workspace.tsx",import.meta.url),"utf8");
assert.ok(ui.includes('replaceReparseErrorId===exceptionRow.id&&replaceReparseError?<p role="alert"'),
  "An error from National must not appear in the New India modal");
assert.ok(ui.includes('setReplaceReparseErrorId(row.id)'),
  "Record the exact intake that failed its source reparse");
assert.ok(!ui.includes('{replaceReparseError?<p role="alert"'),
  "Unscoped cross-intake error display must not return");
const importer=readFileSync(new URL("../lib/policy-national-gcv-record-source.ts",import.meta.url),"utf8");
assert.ok(importer.includes('\\(Upto\\s*6\\)'),
  "Certify the National employee count before its paid-driver liability amount");
assert.ok(importer.includes('(?=\\s+CNG\\/LPG Kit)'),
  "The source amount must terminate at the matching liability row");
console.log("National GCV source and per-intake exception message isolation regression passed");
