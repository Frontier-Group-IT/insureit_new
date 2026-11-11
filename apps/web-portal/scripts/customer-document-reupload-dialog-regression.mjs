import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const modal = read("../components/spot-survey/request-customer-document-reupload-button.tsx");
const stageOne = read("../components/spot-survey/bulk-document-verification-group.tsx");

assert.match(stageOne, /<RequestCustomerDocumentReuploadButton claimId=\{claim\.id\} documentId=\{document\.id\} fileName=\{document\.file_name\}/, "Stage 1 uploaded file rows must display the exact-document customer re-upload action.");
assert.match(modal, /createPortal\(/, "Dialog must use a React portal to escape nested clipping and stacking contexts.");
assert.match(modal, /document\.body/, "Dialog must be mounted at document.body.");
assert.match(modal, /fixed inset-0 z-\[9999\]/, "Backdrop must cover the viewport above claim cards.");
assert.match(modal, /role="dialog" aria-modal="true"/, "Dialog must retain accessible modal semantics.");
assert.match(modal, /useId\(/, "Multiple document buttons must not reuse the same dialog heading ID.");
assert.match(modal, /document\.body\.style\.overflow = "hidden"/, "Modal must prevent background scroll.");
assert.match(modal, /document\.body\.style\.overflow = previousOverflow/, "Modal must restore scroll style on closing.");
assert.match(modal, /event\.key === "Escape"/, "Escape key must close an idle dialog.");
assert.match(modal, /event\.key !== "Tab"/, "Tabbing must remain inside the dialog.");
assert.match(modal, /triggerRef\.current\?\.focus\(\)/, "Closing must return focus to the re-upload button.");
assert.match(modal, /requestSpotSurveyDocumentReupload\(formData\)/, "The original authorized server action must be retained.");
assert.match(modal, /formData\.set\("documentId", documentId\)/, "Re-upload request must still target the exact document.");
assert.match(modal, /router\.refresh\(\)/, "Successful requests must refresh claim evidence.");
console.log("Customer document re-upload dialog layering and accessibility regression passed.");
