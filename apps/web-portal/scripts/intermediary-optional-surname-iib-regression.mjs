import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path) { return readFileSync(resolve(process.cwd(), path), "utf8"); }
function expect(condition, message) { if (!condition) throw new Error(`[intermediary-optional-surname] ${message}`); }

const iibActions = source("app/intermediaries/applications/iib-submission-actions.ts");
const iibStage = source("app/intermediaries/applications/iib-submission-stage.tsx");
const editActions = source("app/customers/applications/intermediary-edit-actions.ts");
const editor = source("app/customers/applications/posp-misp-application-editor.tsx");
const createForm = source("app/customers/posp-misp/posp-misp-onboarding-form.tsx");
const mispForm = source("app/customers/posp-misp/new/misp-modern-onboarding-form.tsx");

expect(!iibActions.includes('["Last name", portalPayload.PoSPLName'), "IIB preparation must not require a surname.");
expect(iibActions.includes('portalPayload.PoSPLName && !NAME.test(portalPayload.PoSPLName)'), "IIB preparation must still validate a supplied surname.");
expect(iibActions.includes('field !== "Last name"'), "IIB handoff must normalize legacy surname-only blockers.");
expect(iibActions.includes('liveIibNames(profile)'), "IIB handoff must refresh names from the canonical intermediary profile.");
expect(iibStage.includes('liveIibNames(profile)'), "IIB review must display canonical live names instead of only the stored packet snapshot.");
expect(iibStage.includes('field !== "Last name"'), "IIB review must ignore the obsolete surname-only missing-field blocker.");

expect(editActions.includes('(posLast&&!validName(posLast))'), "POSP edit validation must treat surname as optional but validate it when present.");
expect(editActions.includes('(dpLast&&!validName(dpLast))'), "MISP DP edit validation must treat surname as optional but validate it when present.");
expect(!/name="pos_last_name"[^>]*\brequired\b/.test(editor), "POSP/Partner workflow editor must not mark last name required.");
expect(!/name="dp_last_name"[^>]*\brequired\b/.test(editor), "MISP workflow editor must not mark DP last name required.");
expect(!/name="pos_last_name"[^>]*\brequired\b/.test(createForm), "POSP initial onboarding must keep last name optional.");
expect(!/name="dp_last_name"[^>]*\brequired\b/.test(mispForm), "MISP initial onboarding must keep DP last name optional.");

console.log("Intermediary optional surname and IIB live-name regression passed.");
