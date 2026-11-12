import type { PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";

export type SemiAutoIssue = {
  field: string;
  message: string;
  section: "Intake" | "Source" | "Customer" | "Vehicle" | "Policy" | "Premium" | "Approval";
};
export type SemiAutoOcrField = {
  key: string;
  value: string;
  label?: string;
  confidence?: number | null;
};
export type SemiAutoReadinessInput = {
  status: string;
  policyType: string | null;
  ocrStatus: string;
  hasCurrentCopy: boolean;
  ocrFields: SemiAutoOcrField[];
  draft: PolicyIntakeDraft;
  draftRevision: number;
  dateDecision: "allowed" | "otp_required" | "invalid" | "future";
};

/** Pure, fail-closed checks performed before any intake is claimed or booked. */
export function checkSemiAutoReadiness(input: SemiAutoReadinessInput): SemiAutoIssue[] {
  const { draft: d } = input;
  const issues: SemiAutoIssue[] = [];
  const add = (section: SemiAutoIssue["section"], field: string, message: string) =>
    issues.push({ section, field, message });
  const value = (text: unknown) => String(text ?? "").trim();
  const money = (text: unknown) => {
    const raw = value(text).replace(/,/g, "");
    return /^\d+(?:\.\d{1,2})?$/.test(raw) ? Number(raw) : null;
  };
  const byKey = new Map(input.ocrFields.map(field => [field.key, field]));

  if (input.policyType !== "motor") add("Intake", "Business line", "Only Motor Intakes are supported in this semi-automatic booking pilot.");
  if (!["ready_for_review", "in_review"].includes(input.status)) {
    add("Intake", "Intake status", "This Intake is " + input.status.replaceAll("_", " ") + ". Return it to Ready for Review before booking.");
  }
  if (input.ocrStatus !== "completed") {
    add("Intake", "Document reading", "Policy extraction is " + input.ocrStatus.replaceAll("_", " ") + ". Retry OCR or upload a readable policy copy.");
  }
  if (!input.hasCurrentCopy) add("Intake", "Policy copy", "No current policy document is attached to this Intake. Upload or restore the official issued policy copy.");

  if (!value(d.intermediaryCode) || !value(d.leadSource) || !value(d.intermediaryType)) {
    add("Source", "Lead Source", "An active POSP, MISP or Partner and its business code are required.");
  }
  if (!value(d.insuredName)) add("Customer", "Insured Name", "Insured Name was not extracted. Enter the exact 'Name of Insured' shown on the policy PDF.");
  if (!/^[6-9]\d{9}$/.test(value(d.phoneNo).replace(/\D/g, "").slice(-10))) {
    add("Customer", "Mobile number", "Customer mobile must be a valid 10-digit Indian number.");
  }
  if (d.registrationMode !== "unregistered" && !value(d.registrationNo)) {
    add("Vehicle", "Registration Number", "Registration Number is missing. Confirm the vehicle registration or explicitly select Unregistered.");
  }
  for (const [field, label] of [
    [d.vehicleClass, "Vehicle Class"], [d.make, "Manufacturer"], [d.model, "Model"],
    [d.fuelType, "Fuel Type"], [d.manufacturingYear, "Manufacturing Year"], [d.capacity, "Capacity"],
    [d.chassisNo, "Chassis Number"], [d.engineNo, "Engine Number"],
  ]) if (!value(field)) add("Vehicle", label, label + " is not available from the policy PDF or saved onboarding draft.");
  if (value(d.vehicleClass) !== "CPM" && (!value(d.rtoState) || !value(d.rtoName))) {
    add("Vehicle", "RTO", "RTO State and RTO Name/Code are required for this vehicle class.");
  }

  if (!value(d.policyNo)) add("Policy", "Policy Number", "Issued Policy Number could not be extracted. Verify the number on the official policy copy.");
  if (!value(d.insurerId)) add("Policy", "Insurer", "Insurer could not be matched to an active insurance company.");
  if (!value(d.policyProduct)) add("Policy", "Policy Product", "Policy Product is missing or incompatible with the selected vehicle class.");
  if (!value(d.validFrom) || !value(d.validUpto)) add("Policy", "Coverage dates", "Both Policy Valid From and Valid Upto are required.");
  else if (d.validFrom > d.validUpto) add("Policy", "Coverage dates", "Policy Valid Upto cannot precede Valid From.");

  // Intake handoff defaults issuance date to today; it is NOT evidence of the PDF's date.
  // A later saved draft represents a human correction, confirmed again before booking.
  if (input.draftRevision <= 1 && !byKey.has("policy_issuance_date")) {
    add("Policy", "Policy Issuance Date", "The handoff defaults issuance date to today, not the PDF date. Open Policy Onboarding, verify the issue date against the policy copy, and save the corrected draft.");
  }
  if (!value(d.issuanceDate) || input.dateDecision === "invalid" || input.dateDecision === "future") {
    add("Policy", "Policy Issuance Date", "Enter a valid issuance date in the current or an earlier month.");
  } else if (input.dateDecision === "otp_required") {
    add("Approval", "Date approval", "This policy's issuance date requires email OTP approval. Use standard Policy Onboarding for an authorized approver to verify the OTP.");
  }

  const product = value(d.policyProduct).toUpperCase();
  if (product === "BUNDLED") add("Policy", "Bundled coverage", "Bundled OD/TP/CPA expiry and any add-on premium need separate verification. Complete this policy using the standard onboarding form.");
  if (product !== "THIRD PARTY" && money(d.idv) === null) add("Premium", "IDV", "IDV is missing or not a valid monetary amount.");
  const od = money(d.od);
  const tp = money(d.tp);
  const cpa = money(d.cpa);
  if (product !== "THIRD PARTY" && od === null) add("Premium", "OD Premium", "OD Premium is missing or invalid. Verify the policy premium schedule.");
  if (product !== "SAOD" && tp === null) add("Premium", "TP Premium", "Third-party Premium is missing or invalid. Verify the policy premium schedule.");
  if (cpa === null && value(d.cpa)) add("Premium", "CPA Premium", "CPA Premium has an invalid amount.");
  if (value(d.vehicleClass) === "GCV" && (d.cpaOpted !== "Yes" || !(cpa !== null && cpa > 0))) {
    add("Premium", "GCV CPA", "GCV requires CPA Opted = Yes and a positive, verified CPA amount.");
  }
  if (cpa !== null && cpa > 0 && d.cpaOpted !== "Yes") {
    add("Premium", "CPA Opted", "A CPA premium is present but CPA Opted remains No. Confirm the CPA selection.");
  }
  if (!value(d.policyNo) && byKey.has("policy_number")) {
    add("Policy", "Policy Number", "The OCR policy number could not be normalized for booking.");
  }
  const net = money(byKey.get("total_premium")?.value);
  const tax = money(byKey.get("tax_amount")?.value);
  const gross = money(byKey.get("gross_premium")?.value);
  if (net !== null && tax !== null && gross !== null && Math.abs(net + tax - gross) > 1) {
    add("Premium", "Printed totals", "The printed net premium plus GST does not match printed gross premium. Confirm discounts, add-ons and the complete premium breakup.");
  }
  // Do not silently book clearly low-confidence policy/identity values.
  for (const key of ["policy_number", "insurer_name", "policy_start_date", "policy_end_date", "vehicle_chassis_number", "vehicle_engine_number"]) {
    const source = byKey.get(key);
    if (source && source.confidence !== null && source.confidence !== undefined && source.confidence < 0.75 && input.draftRevision <= 1) {
      add(key.startsWith("vehicle") ? "Vehicle" : "Policy", source.label || key, "Low-confidence OCR value (" + Math.round(source.confidence * 100) + "%). Verify the field in Policy Onboarding and save it.");
    }
  }
  return issues;
}
