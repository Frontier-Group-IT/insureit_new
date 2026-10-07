import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

export type CustomerProfileRecord = {
  id: string;
  customer_code: string;
  company_name: string | null;
  contact_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  onboarding_status: string;
};

export type CustomerVaultDocument = {
  id: string;
  customer_id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type CustomerKycApplication = {
  id: string;
  profile_id: string | null;
  source: "customer_app" | "manager_portal";
  partner_type: "individual_proprietor" | "dealership" | "corporate" | "group" | null;
  status: "not_started" | "in_progress" | "submitted" | "under_review" | "changes_requested" | "approved" | "rejected" | "cancelled";
  current_step: number;
  applicant_phone: string | null;
  applicant_email: string | null;
  draft_data: Record<string, unknown> | null;
  customer_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
};

export type CustomerKycDocument = {
  id: string;
  application_id: string;
  document_type: "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy";
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

export const loadCustomerProfile = cache(async (customerId: string) => {
  const session = await getCustomerWebSession();
  if (!session.accounts.some((account) => account.id === customerId)) throw new Error("Customer account is not authorized.");

  const supabase = await createServerSupabaseClient();
  const [customerResult, documentsResult, onboardingResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id,customer_code,company_name,contact_name,phone,email,address,city,state,postal_code,onboarding_status")
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_documents")
      .select("id,customer_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_onboarding_applications")
      .select("id,profile_id,source,partner_type,status,current_step,applicant_phone,applicant_email,draft_data,customer_id,submitted_at,reviewed_at,completed_at")
      .eq("profile_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (customerResult.error || !customerResult.data) throw new Error("Customer profile is temporarily unavailable.");
  const application = (onboardingResult.data ?? null) as CustomerKycApplication | null;
  let kycDocuments: CustomerKycDocument[] = [];
  if (application) {
    const result = await supabase
      .from("customer_onboarding_documents")
      .select("id,application_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,rejection_reason,created_at")
      .eq("application_id", application.id)
      .order("created_at", { ascending: true });
    if (!result.error) kycDocuments = (result.data ?? []) as CustomerKycDocument[];
  }

  return {
    customer: customerResult.data as CustomerProfileRecord,
    profile: session.profile,
    documents: (documentsResult.data ?? []) as CustomerVaultDocument[],
    kyc: application,
    kycDocuments,
  };
});

export async function createCustomerDocumentSignedUrl(customerId: string, documentId: string) {
  const { documents } = await loadCustomerProfile(customerId);
  const document = documents.find((item) => item.id === documentId);
  if (!document) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
  return error ? null : data.signedUrl;
}

export function customerKycStatusLabel(status?: CustomerKycApplication["status"] | null) {
  if (status === "approved") return "Verified";
  if (status === "submitted" || status === "under_review") return "Under review";
  if (status === "changes_requested") return "Changes requested";
  if (status === "rejected") return "Rejected";
  if (status === "in_progress") return "In progress";
  return "Pending";
}

export function customerKycTone(status?: CustomerKycApplication["status"] | null) {
  if (status === "approved") return "active" as const;
  if (status === "submitted" || status === "under_review" || status === "in_progress") return "due" as const;
  if (status === "rejected") return "expired" as const;
  return "neutral" as const;
}

export function customerDraftText(draft: Record<string, unknown> | null | undefined, key: string) {
  const value = draft?.[key];
  return typeof value === "string" ? value : "";
}
