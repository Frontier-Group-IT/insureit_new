import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { customerSpotStatusMilestone } from "../lib/customer-internal-spot-status.ts";

const source = readFileSync("lib/customer-web-phase2-data.ts", "utf8");
assert.match(source, /const claim = claims\.find\(\(item\) => item\.id === claimId\)/, "customer claim must be authorized before stage lookup");
assert.match(source, /if \(!claim\) notFound\(\)/, "missing or unauthorized claim must be rejected");
assert.match(source, /!isExternalCustomerClaim\(claim\) && claim\.claim_service_mode === "broker_managed"/, "external and self-managed journeys must not use the internal read");
assert.match(source, /\.eq\("claim_id", claim\.id\)/, "privileged query must be limited to the authorized claim");
assert.match(source, /\.eq\("details->>milestone_key", "spot_status"\)/, "only Stage 2 Operations records may be projected");
assert.match(source, /\.order\("created_at", \{ ascending: false \}\)/, "latest Operations stage entry should be used");

const saved = customerSpotStatusMilestone({
  id: "stage-detail-1",
  claim_id: "claim-1",
  created_at: "2026-11-03T11:39:52Z",
  details: {
    milestone_key: "spot_status",
    spot_survey_done_date: "2026-11-02",
    surveyor_name: "SDFLJKD",
    surveyor_email: "DFJKG@GMAIL.COM",
    surveyor_phone: "7869586978",
    completed_at: "2026-11-03T11:39:52Z",
    internal_notes: "This is not customer-facing",
    private_operational_flag: true,
  },
});
assert.equal(saved?.milestone_key, "spot_status");
assert.equal(saved?.milestone_status, "completed");
assert.deepEqual(saved?.details, {
  spot_survey_done_date: "2026-11-02",
  surveyor_name: "SDFLJKD",
  surveyor_email: "DFJKG@GMAIL.COM",
  surveyor_phone: "7869586978",
});
assert.equal(saved?.completed_at, "2026-11-03T11:39:52Z");
assert.equal(customerSpotStatusMilestone({
  id: "not-spot", claim_id: "claim-1", created_at: "", details: { milestone_key: "claim_intimation" },
}), null);
console.log("Customer internal Spot Status parity and privacy regression passed.");
