import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
const form = read("../app/customer/(protected)/spot-intimation/page.tsx");
const save = read("../app/customer/(protected)/spot-intimation/spot-intimation-save-form.tsx");

// Spot Intimation corrections now navigate without an intermediate success popup
// or a stale URL success marker; server-side access and save validation are intact.
assert.doesNotMatch(page, /CustomerSpotSaveSuccess|q\.updated/, "Do not render success popup after Spot Intimation corrections.");
assert.doesNotMatch(form, /updated=1/, "Correction redirects must not include a stale success marker.");
assert.match(form, /saveCustomerInternalSpotCorrection/, "Keep server-authorized Spot Intimation correction.");
assert.match(form, /if\(!result\.saved\)return \{error:/, "Only navigate after confirmed correction save.");
assert.match(save, /else if \(result\.destination\)/, "Navigation requires a confirmed destination.");
assert.match(save, /router\.push\(result\.destination\)/, "Navigate immediately following a successful save.");
assert.match(save, /if \(!navigating\) setPending\(false\)/, "Keep Saving... while navigating.");
assert.doesNotMatch(save, /CustomerSuccessDialog|successNotice|savedDestination/, "No Spot Intimation saved popup.");
assert.match(save, /<CustomerErrorDialog/, "Keep actionable validation and save errors.");

console.log("Customer Spot Intimation direct save-and-continue navigation regression passed.");
