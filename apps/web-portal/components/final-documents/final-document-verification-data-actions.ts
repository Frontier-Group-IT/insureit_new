"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ClaimRow = {
  id: string;
  customer_id: string;
  policy_id: string | null;
  external_policy_id: string | null;
  accident_at: string | null;
  claim_service_mode: "broker_managed" | "self_managed" | null;
};

type PolicyDates = { start_date: string | null; end_date: string | null };

export type FinalVerificationDocument = {
  id: string;
  document_type: string | null;
  file_name: string;
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string | null;
  signedUrl: string;
};

export type FinalVerificationRow = {
  id: string;
  claim_id: string;
  document_id: string | null;
  document_type: string;
  verification_type: "rc" | "insurance" | "document" | "detail";
  incident_date: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type FinalVerificationData = {
  claim: {
    id: string;
    customer_id: string;
    accident_at: string | null;
    policies: PolicyDates | null;
  };
  documents: FinalVerificationDocument[];
  verifications: FinalVerificationRow[];
};

type Result = { ok: true; data: FinalVerificationData } | { ok: false; message: string };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
    throw new Error("You do not have permission to verify claim documents.");
  }
  return profile;
}

export async function loadFinalDocumentVerificationData(claimId: string): Promise<Result> {
  try {
    if (!claimId.trim()) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const admin = createSupabaseAdminClient();
    const { data: claim, error: claimError } = await admin
      .from("claims")
      .select("id, customer_id, policy_id, external_policy_id, accident_at, claim_service_mode")
      .eq("id", claimId)
      .maybeSingle<ClaimRow>();
    if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");
    if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "manage_claims"))) {
      throw new Error("You do not have permission to verify claim documents.");
    }
    if (claim.claim_service_mode !== "broker_managed") {
      throw new Error("Operations can process this claim only after assistance is accepted.");
    }

    let policyDates: PolicyDates | null = null;
    if (claim.external_policy_id) {
      const { data } = await admin
        .from("external_policies")
        .select("start_date, end_date")
        .eq("id", claim.external_policy_id)
        .eq("customer_id", claim.customer_id)
        .maybeSingle<PolicyDates>();
      policyDates = data ?? null;
    } else if (claim.policy_id) {
      const { data } = await admin
        .from("policies")
        .select("start_date, end_date")
        .eq("id", claim.policy_id)
        .eq("customer_id", claim.customer_id)
        .maybeSingle<PolicyDates>();
      policyDates = data ?? null;
    }

    const [{ data: documents, error: documentsError }, { data: verifications, error: verificationsError }] = await Promise.all([
      admin
        .from("claim_documents")
        .select("id, document_type, file_name, verification_status, rejection_reason, created_at")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .returns<Array<Omit<FinalVerificationDocument, "signedUrl">>>(),
      admin
        .from("claim_document_verifications")
        .select("id, claim_id, document_id, document_type, verification_type, incident_date, is_valid, invalid_reason, details, created_at")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false })
        .returns<FinalVerificationRow[]>(),
    ]);
    if (documentsError) throw new Error(documentsError.message);
    if (verificationsError) throw new Error(verificationsError.message);

    return {
      ok: true,
      data: {
        claim: {
          id: claim.id,
          customer_id: claim.customer_id,
          accident_at: claim.accident_at,
          policies: policyDates,
        },
        documents: (documents ?? []).map((document) => ({
          ...document,
          file_name: document.file_name || "Unnamed claim document",
          signedUrl: `/claim-documents/${document.id}/open`,
        })),
        verifications: verifications ?? [],
      },
    };
  } catch (error) {
    console.error("loadFinalDocumentVerificationData failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to load claim documents." };
  }
}
