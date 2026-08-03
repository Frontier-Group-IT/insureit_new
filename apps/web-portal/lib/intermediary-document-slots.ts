export type IntermediaryDocumentRecord = {
  document_type: string;
  file_name: string;
  document_label?: string | null;
};

export type IntermediaryDocumentSlot = {
  key: string;
  title: string;
  required: boolean;
  custom: boolean;
  education: boolean;
};

export const EDUCATION_DOCUMENT_TYPES = [
  "education_10th_marksheet",
  "education_12th_marksheet",
  "education_graduation_marksheet",
  "education_post_graduation_marksheet",
] as const;

export const CUSTOM_DOCUMENT_TYPES = ["custom_1", "custom_2", "custom_3", "custom_4"] as const;
export const HISTORICAL_DOCUMENT_TYPES = ["training_certificate", "registration_certificate", "agreement_copy"] as const;

const BASE_SLOTS: IntermediaryDocumentSlot[] = [
  { key: "aadhaar_front", title: "Aadhaar Front", required: true, custom: false, education: false },
  { key: "aadhaar_back", title: "Aadhaar Back", required: true, custom: false, education: false },
  { key: "pan_copy", title: "PAN Copy", required: true, custom: false, education: false },
  { key: "cancelled_cheque", title: "Cancelled Cheque", required: true, custom: false, education: false },
  { key: "photograph", title: "Photograph", required: true, custom: false, education: false },
  { key: "education", title: "Education Marksheet", required: false, custom: false, education: true },
];

export function buildIntermediaryDocumentSlots({ legacy, hasGst }: { legacy: boolean; hasGst: boolean }) {
  const slots = [...BASE_SLOTS];

  if (legacy) {
    slots.push(
      { key: "training_certificate", title: "Training Certificate", required: false, custom: false, education: false },
      { key: "registration_certificate", title: "Registration Certificate", required: false, custom: false, education: false },
      { key: "agreement_copy", title: "Agreement Copy", required: false, custom: false, education: false },
    );
    slots.push(
      hasGst
        ? { key: "gst_copy", title: "GST Certificate", required: true, custom: false, education: false }
        : { key: "custom_1", title: "Other Document", required: false, custom: true, education: false },
    );
    return slots;
  }

  if (hasGst) slots.push({ key: "gst_copy", title: "GST Certificate", required: true, custom: false, education: false });
  const customCount = hasGst ? 3 : 4;
  for (let index = 1; index <= customCount; index += 1) {
    slots.push({ key: `custom_${index}`, title: "Other Document", required: false, custom: true, education: false });
  }
  return slots;
}

export function findDocumentForSlot(slot: IntermediaryDocumentSlot, documents: IntermediaryDocumentRecord[]) {
  if (slot.education) return documents.find((document) => EDUCATION_DOCUMENT_TYPES.includes(document.document_type as (typeof EDUCATION_DOCUMENT_TYPES)[number]));
  return documents.find((document) => document.document_type === slot.key);
}

export function slotTitle(slot: IntermediaryDocumentSlot, document?: IntermediaryDocumentRecord | null) {
  if (slot.custom) return document?.document_label?.trim() || slot.title;
  return slot.title;
}
