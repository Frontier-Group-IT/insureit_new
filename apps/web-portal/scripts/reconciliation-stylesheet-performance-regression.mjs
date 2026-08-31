import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rootLayout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const reconciliationLayout = await readFile(new URL("../app/reconciliation/layout.tsx", import.meta.url), "utf8");

assert.ok(
  !rootLayout.includes('import "./reconciliation-workbench.css";'),
  "Reconciliation-only stylesheet should not be loaded by the root layout.",
);
assert.ok(
  reconciliationLayout.includes('import "../reconciliation-workbench.css";'),
  "Reconciliation layout should load its workbench stylesheet.",
);

console.log("Reconciliation stylesheet performance regression passed.");
