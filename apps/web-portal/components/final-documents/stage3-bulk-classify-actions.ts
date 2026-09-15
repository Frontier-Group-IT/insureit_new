"use server";

import { CLAIM_INTIMATION_DOCUMENT_GROUPS } from "@insureit/claim-journey";
import { revalidatePath } from "next/cache";
import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";

const BULK_DOCUMENT_TYPE = "Additional Claim Document";
const allowedTypes = new Set<string>(CLAIM_INTIMATION_DOCUMENT_GROUPS.flatMap((group) => group.documents.map((document) => document.type)));

type ActionResult = { ok: boolean; message?: string };
export type Stage3UnclassifiedAttachment = { id: string; fileName: string; viewUrl: string };

export async function loadStage3UnclassifiedAttachments(claimId: string): Promise<{ ok: boolean; attachments?: Stage3UnclassifiedAttachment[]; message?: string }> {
  try {
    if (!claimId.trim()) throw new Error("Missing claim id.");
    const { supabase } = await requireClaimWorkflowAccess(claimId, "You do not have permission to classify claim documents.");
    const { data, error } = await supabase.from("claim_documents").select("id,file_name").eq("claim_id", claimId).eq("document_type", BULK_DOCUMENT_TYPE).neq("verification_status", "rejected").order("created_at", { ascending: false }).returns<Array<{ id: string; file_name: string }>>();
    if (error) throw new Error(error.message);
    return { ok: true, attachments: (data ?? []).map((document) => ({ id: document.id, fileName: document.file_name, viewUrl: `/claim-documents/${document.id}/open` })) };
  } catch (error) {
    console.error("loadStage3UnclassifiedAttachments failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to load unclassified claim attachments." };
  }
}

export async function classifyStage3BulkAttachment(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentId = String(formData.get("documentId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    if (!claimId || !documentId || !allowedTypes.has(documentType)) throw new Error("Choose a valid document category.");

    const { profile, supabase } = await requireClaimWorkflowAccess(claimId, "You do not have permission to classify claim documents.");
    const { data: claim, error: claimError } = await supabase.from("claims").select("id,current_status").eq("id", claimId).maybeSingle<{ id: string; current_status: string | null }>();
    if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");
    const { data: document, error: documentError } = await supabase.from("claim_documents").select("id,document_type,file_name").eq("id", documentId).eq("claim_id", claimId).maybeSingle<{ id: string; document_type: string; file_name: string }>();
    if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");
    if (document.document_type !== BULK_DOCUMENT_TYPE) throw new Error("This attachment has already been classified.");

    const { error: updateError } = await supabase.from("claim_documents").update({ document_type: documentType }).eq("id", documentId).eq("claim_id", claimId).eq("document_type", BULK_DOCUMENT_TYPE);
    if (updateError) throw new Error(updateError.message);
    const { error: historyError } = await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: `${document.file_name} classified as ${documentType} during Claim Intimation document verification.`, changed_by: profile.id });
    if (historyError) throw new Error(historyError.message);

    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/partner/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/partner/claims");
    revalidatePath("/dashboard");
    return { ok: true, message: "Attachment classified successfully." };
  } catch (error) {
    console.error("classifyStage3BulkAttachment failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Attachment classification failed." };
  }
}
