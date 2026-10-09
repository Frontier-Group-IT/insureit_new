export const CUSTOMER_EXTERNAL_STAGE_FIELDS: Record<string, { key: string; label: string; type: "date" | "text" | "number" | "email" | "tel" | "boolean" | "yesno"; optional?: boolean }[]> = {
  spot_status: [
    { key: "spot_survey_done_date", label: "Spot Survey Done Date", type: "date" },
    { key: "surveyor_name", label: "Surveyor Name", type: "text" },
    { key: "surveyor_email", label: "Surveyor Email", type: "email" },
    { key: "surveyor_phone", label: "Surveyor Number", type: "tel" },
  ],
  claim_intimation: [
    { key: "claim_intimation_date", label: "Claim Intimation Date", type: "date" },
    { key: "dealership_name", label: "Dealership Name", type: "text" },
    { key: "dealership_location", label: "Dealership Location", type: "text" },
    { key: "gate_in_date", label: "Gate In Date", type: "date" },
    { key: "estimate_amount", label: "Estimate Amount", type: "number" },
  ],
  work_approval: [
    { key: "approval_received_date", label: "Approval Received Date", type: "date" },
    { key: "cashless", label: "Cashless Claim", type: "boolean" },
    { key: "surveyor_name", label: "Surveyor Name", type: "text", optional: true },
    { key: "surveyor_phone", label: "Surveyor Phone", type: "tel", optional: true },
    { key: "surveyor_email", label: "Surveyor Email", type: "email", optional: true },
  ],
  repair_ri: [
    { key: "repair_complete_date", label: "Repair Complete Date", type: "date" },
    { key: "ri_requested_date", label: "RI Requested Date", type: "date", optional: true },
    { key: "ri_done_date", label: "RI Done Date", type: "date" },
  ],
  billing: [
    { key: "bill_date", label: "Bill Date", type: "date" },
    { key: "bill_amount", label: "Bill Amount", type: "number" },
  ],
  delivery_order: [
    { key: "assessment_received", label: "Assessment Received?", type: "boolean" },
    { key: "do_date", label: "Delivery Order Date", type: "date" },
    { key: "do_amount", label: "Delivery Order Amount", type: "number" },
  ],
  vehicle_delivery: [
    { key: "vehicle_received", label: "Vehicle Received?", type: "yesno" },
    { key: "vehicle_received_date", label: "Vehicle Received Date", type: "date", optional: true },
  ],
  payment_encashment: [
    { key: "depreciation_submitted", label: "Depreciation Slip Submitted?", type: "yesno" },
    { key: "satisfaction_submitted", label: "Satisfaction Voucher Submitted?", type: "yesno" },
    { key: "documents_submit_date", label: "Documents Submit Date", type: "date", optional: true },
    { key: "payment_received_date", label: "Payment Received Date", type: "date" },
    { key: "payment_received_amount", label: "Amount Received", type: "number" },
  ],
};
