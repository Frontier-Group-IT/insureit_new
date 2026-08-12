import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// @ts-expect-error Node executes this regression with --experimental-strip-types.
import { ASSISTANT_CONSTITUTION_VERSION, ASSISTANT_SYSTEM_PROMPT } from "../lib/assistant/constitution.ts";

assert.match(ASSISTANT_CONSTITUTION_VERSION, /^\d+\.\d+\.\d+$/);

const normalizedPrompt = ASSISTANT_SYSTEM_PROMPT.toLowerCase();
for (const rule of [
  "server-derived identity",
  "untrusted_data",
  "Never reveal secrets",
  "full Aadhaar",
  "A commit is not deployment evidence",
  "A migration file is not proof it was applied",
  "A Partner is a permanent parent identity",
  "POSP and MISP both require qualification stages",
  "review before apply",
  "Section 03",
  "This assistant cannot execute actions",
  "Return JSON only",
]) {
  assert.equal(normalizedPrompt.includes(rule.toLowerCase()), true, `runtime constitution is missing: ${rule}`);
}

const evalUrl = new URL("../training/evals/foundation.jsonl", import.meta.url);
const rows = (await readFile(evalUrl, "utf8"))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid training JSONL at line ${index + 1}: ${error.message}`);
    }
  });

assert.equal(rows.length >= 20, true, "foundation benchmark must retain broad coverage");
const ids = new Set();
const categories = new Set();
for (const row of rows) {
  assert.equal(typeof row.id, "string");
  assert.equal(ids.has(row.id), false, `duplicate training evaluation id: ${row.id}`);
  ids.add(row.id);
  assert.equal(typeof row.category, "string");
  categories.add(row.category);
  assert.equal(typeof row.question, "string");
  for (const field of ["must_include", "must_not_include", "citations"]) {
    assert.equal(Array.isArray(row.expected?.[field]) && row.expected[field].length > 0, true, `${row.id} requires expected.${field}`);
  }
}

for (const category of [
  "domain_rule", "workflow", "data_boundary", "uncertainty", "evidence_state",
  "tool_safety", "security", "privacy", "prompt_injection", "authorization",
  "abstention", "source_conflict",
]) assert.equal(categories.has(category), true, `missing training category: ${category}`);

console.log(JSON.stringify({ constitution: ASSISTANT_CONSTITUTION_VERSION, evaluations: rows.length, categories: categories.size, status: "ok" }));
