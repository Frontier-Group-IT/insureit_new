export type VisualAssetDefinition = {
  src: string;
  alt: string;
  position?: string;
};

export const documentVisuals: Record<string, VisualAssetDefinition> = {
  aadhaar_front: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card front visual" },
  aadhaar_back: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card back visual", position: "center" },
  representative_aadhaar_front: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card front visual" },
  representative_aadhaar_back: { src: "/document-assets/aadhaar-card.png", alt: "Aadhaar card back visual", position: "center" },
  pan_copy: { src: "/document-assets/pan-card.png", alt: "PAN card visual" },
  company_pan_copy: { src: "/document-assets/pan-card.png", alt: "PAN card visual" },
  representative_pan_copy: { src: "/document-assets/pan-card.png", alt: "PAN card visual" },
  photograph: { src: "/document-assets/photograph.png", alt: "Photograph visual" },
  cancelled_cheque: { src: "/document-assets/cancelled-cheque.png", alt: "Cancelled cheque visual" },
  education: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_marksheet: { src: "/document-assets/education-certificate.png", alt: "Education certificate visual" },
  education_10th_marksheet: { src: "/document-assets/education-certificate.png", alt: "10th marksheet visual" },
  education_12th_marksheet: { src: "/document-assets/education-certificate.png", alt: "12th marksheet visual" },
  education_graduation_marksheet: { src: "/document-assets/education-certificate.png", alt: "Graduation marksheet visual" },
  education_post_graduation_marksheet: { src: "/document-assets/education-certificate.png", alt: "Post-graduation marksheet visual" },
  agreement_copy: { src: "/document-assets/agreement-copy.png", alt: "Agreement document visual" },
  gst_copy: { src: "/document-assets/gst-certificate.png", alt: "GST certificate visual" },
  registration_form: { src: "/document-assets/registration-form.png", alt: "Registration form visual" },
};

export const fallbackDocumentVisual: VisualAssetDefinition = {
  src: "/document-assets/identity-card.png",
  alt: "Document visual",
};

export const emptyStateVisuals = {
  no_data: "/visuals/empty-states/no-data.webp",
  no_results: "/visuals/empty-states/no-results.webp",
  no_documents: "/visuals/empty-states/no-documents.webp",
  no_activity: "/visuals/empty-states/no-activity.webp",
  access_denied: "/visuals/empty-states/access-denied.webp",
} as const;

export const iibStatusVisuals = {
  pending: "/visuals/iib/waiting.webp",
  checking: "/visuals/iib/checking.webp",
  not_found: "/visuals/iib/not-found.webp",
  matched: "/visuals/iib/matched.webp",
  failed: "/visuals/iib/failed.webp",
} as const;
