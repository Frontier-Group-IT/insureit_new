import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The shared edit route now only dispatches Life/Health policies away from the
// standard editor. Motor and Non-Motor edit behaviour lives unchanged in the
// extracted standard implementation, so cache invariants belong there.
const source = await readFile(
  new URL("../app/policies/[id]/edit/policy-edit-standard.tsx", import.meta.url),
  "utf8",
);

assert.ok(
  source.includes("getActiveInsuranceCompanyOptions()"),
  "Policy Edit should reuse cached active insurer options.",
);
assert.ok(
  !source.includes('.eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>()'),
  "Policy Edit should not directly query the active insurer list.",
);
assert.ok(
  source.includes('admin.from("insurance_companies").select("id,name,is_active").eq("id", policy.insurance_company_id)'),
  "Policy Edit must still read the current insurer so an inactive saved insurer remains visible.",
);
assert.ok(
  source.includes("!currentInsurerResult.data.is_active"),
  "Inactive current insurers should remain explicitly represented.",
);
assert.ok(
  source.includes("— Inactive"),
  "Inactive current insurer labels should remain clear to the user.",
);

console.log("Policy edit insurer cache regression passed.");
