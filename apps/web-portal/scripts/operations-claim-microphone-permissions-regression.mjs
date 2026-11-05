import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const config = read("../next.config.mjs");
const controls = read("../components/claim-manager/operations-claim-stage-one-attachments.tsx");
const uploads = read("../app/claims/[id]/claim-document-upload-actions.ts");

assert.match(config, /source: "\/claims\/:id", headers: voiceLabHeaders/, "Operations claim details must permit the microphone");
assert.match(config, /microphone=\(self\)/, "Operations microphone must remain same-origin only");
assert.match(config, /microphone=\(\)/, "Default non-claim routes must still deny microphone");
assert.doesNotMatch(config, /source: "\/claims\/:path\*"/, "Do not grant broad Operations microphone permission");
for (const path of ["/customer/spot-intimation", "/customer/claims/:id/stage/:stage"]) {
  assert.ok(config.includes('source: "' + path + '", headers: voiceLabHeaders'), "Preserve customer microphone permissions for " + path);
}

assert.match(controls, /navigator\.mediaDevices\.getUserMedia\(\{ audio: true \}\)/, "Recording must request user permission");
assert.match(controls, /name === "NotAllowedError" \|\| name === "SecurityError"/, "Permission denial needs a specific message");
assert.match(controls, /name === "NotFoundError" \|\| name === "DevicesNotFoundError"/, "Missing microphone needs a specific message");
assert.match(controls, /name === "NotReadableError" \|\| name === "TrackStartError"/, "Busy microphone needs a specific message");
assert.match(controls, /name === "OverconstrainedError"/, "Unsupported device constraints must be handled");
assert.match(controls, /micStream\.current\?\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/, "Failed starts release input tracks");
assert.match(controls, /recorder\.current = null/, "Failed starts reset the recorder");
assert.match(controls, /setRecording\(false\)/, "Failed starts restore the record button");
assert.match(controls, /Choose audio/, "Keep existing-file fallback");
assert.match(controls, /Upload voice note/, "Keep upload action");
assert.match(controls, /submitFiles\(\[audioFile\], true\)/, "Voice file upload must still use signed workflow");
assert.match(controls, /router\.refresh\(\)/, "Successful uploads refresh evidence");
assert.match(uploads, /expectedAudio = documentType === "Incident Voice Note"/, "Audio must remain scoped to voice-note document type");
assert.match(uploads, /requireClaimWorkflowAccess\(claimId/, "Claim access control must remain enforced");

console.log("Operations claim microphone policy, recorder recovery and signed voice upload regression passed.");
