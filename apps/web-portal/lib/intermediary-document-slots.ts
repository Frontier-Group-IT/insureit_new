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
  system?: boolean;
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

export function buildIntermediaryDocumentSlots({
  legacy,
  hasGst,
  documents = [],
}: {
  legacy: boolean;
  hasGst: boolean;
  documents?: IntermediaryDocumentRecord[];
}) {
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

  // New POSP/MISP onboarding always reserves one of the ten visual document slots
  // for the signed registration certificate. Existing custom documents are kept
  // visible first, so old records are never silently displaced or deleted.
  const customAllowance = hasGst ? 2 : 3;
  const occupiedCustomKeys = CUSTOM_DOCUMENT_TYPES.filter((key) =>
    documents.some((document) => document.document_type === key && Boolean(document.file_name?.trim())),
  );
  const selectedCustomKeys = [
    ...occupiedCustomKeys,
    ...CUSTOM_DOCUMENT_TYPES.filter((key) => !occupiedCustomKeys.includes(key)),
  ].slice(0, customAllowance);

  slots.push({
    key: "signed_registration_form",
    title: "Signed Registration Certificate",
    required: false,
    custom: false,
    education: false,
    system: true,
  });

  for (const key of selectedCustomKeys) {
    slots.push({ key, title: "Other Document", required: false, custom: true, education: false });
  }

  return slots;
}

export function findDocumentForSlot(slot: IntermediaryDocumentSlot, documents: IntermediaryDocumentRecord[]) {
  if (slot.education) {
    return documents.find((document) => EDUCATION_DOCUMENT_TYPES.includes(document.document_type as (typeof EDUCATION_DOCUMENT_TYPES)[number]));
  }
  if (slot.key === "registration_certificate") {
    return documents.find((document) => document.document_type === "signed_registration_form")
      ?? documents.find((document) => document.document_type === "registration_certificate");
  }
  return documents.find((document) => document.document_type === slot.key);
}

export function slotTitle(slot: IntermediaryDocumentSlot, document?: IntermediaryDocumentRecord | null) {
  if (slot.key === "registration_certificate" && document?.document_type === "signed_registration_form") {
    return "Signed Registration Certificate";
  }
  if (slot.custom) return document?.document_label?.trim() || document?.file_name?.trim() || slot.title;
  return slot.title;
}
