import fs from "node:fs";

const path = "apps/web-portal/components/policy-form-authbridge.tsx";
let text = fs.readFileSync(path, "utf8");

const importAnchor = 'import { lookupPolicyRegistrationRc, type PolicyRcReview } from "@/app/policies/authbridge-rc-actions";';
const importLine = 'import { PolicyOcrImportPanel } from "@/components/policy-ocr-import-panel";';
if (!text.includes(importLine)) {
  if (!text.includes(importAnchor)) throw new Error("AuthBridge import anchor not found");
  text = text.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const oldButton = '<button type="button" onClick={submitPolicy} disabled={isSubmitting} className="rounded-xl bg-white px-5 py-2.5 text-[10px] font-bold text-[#071D49] shadow-sm disabled:opacity-60">{isSubmitting ? "Booking policy…" : "Book Active Policy"}</button>';
const newButtons = '<div className="flex flex-wrap items-center gap-2"><PolicyOcrImportPanel/><button type="button" onClick={submitPolicy} disabled={isSubmitting} className="rounded-xl bg-white px-5 py-2.5 text-[10px] font-bold text-[#071D49] shadow-sm disabled:opacity-60">{isSubmitting ? "Booking policy…" : "Book Active Policy"}</button></div>';
if (!text.includes(oldButton)) throw new Error("Policy header booking button anchor not found");
text = text.replace(oldButton, newButtons);

if (!text.includes('<PolicyOcrImportPanel/>')) throw new Error("OCR header button was not inserted");
fs.writeFileSync(path, text);
