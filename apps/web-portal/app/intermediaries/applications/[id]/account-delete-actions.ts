"use server";

import { revalidatePath } from "next/cache";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type IntermediaryDeletionMode = "child" | "partner";

export type IntermediaryDeletionResult =
  | { ok: true; redirectTo: string; cleanupWarning: boolean }
  | { ok: false; message: string };

type ApplicationRow = {
  id: string;
  partner_record_id: string | null;
  draft_data: Record<string, unknown> | null;
};

type StoredDocument = {
  storage_bucket: string;
  storage_path: string;
};

export async function deleteIntermediaryAccount(
  applicationId: string,
  deletionMode: IntermediaryDeletionMode,
): Promise<IntermediaryDeletionResult> {
  if (!applicationId || !["child", "partner"].includes(deletionMode)) {
    return { ok: false, message: "The delete request is invalid." };
  }

  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id || !hasCapability(reviewer.role, "manage_system")) {
    return { ok: false, message: "Only a system administrator can permanently delete intermediary accounts." };
  }

  const admin = createSupabaseAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,partner_record_id,draft_data")
    .eq("id", applicationId)
    .maybeSingle<ApplicationRow>();

  if (applicationError || !application) {
    return { ok: false, message: "The account could not be found. It may already have been deleted." };
  }

  const accountContext = readAccountContext(application.draft_data);
  if (deletionMode === "child" && accountContext === "partner") {
    return { ok: false, message: "Use the Partner deletion option to delete a Partner account." };
  }
  if (deletionMode === "partner" && accountContext !== "partner") {
    return { ok: false, message: "Only a Partner account can use Partner-and-linked-account deletion." };
  }

  let targetApplicationIds: string[];
  try {
    targetApplicationIds = await resolveTargetApplicationIds(admin, application, deletionMode);
  } catch (error) {
    console.error("Intermediary deletion target resolution failed", {
      applicationId,
      deletionMode,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false, message: "Linked accounts could not be verified, so deletion was stopped safely." };
  }

  if (!targetApplicationIds.length) {
    return { ok: false, message: "No accounts were selected for deletion." };
  }

  const [{ data: portalAccounts, error: portalError }, { data: documents, error: documentError }] = await Promise.all([
    admin
      .from("intermediary_portal_accounts")
      .select("auth_user_id")
      .in("application_id", targetApplicationIds)
      .returns<Array<{ auth_user_id: string | null }>>(),
    admin
      .from("intermediary_onboarding_documents")
      .select("storage_bucket,storage_path")
      .in("application_id", targetApplicationIds)
      .returns<StoredDocument[]>(),
  ]);

  if (portalError) {
    console.error("Intermediary deletion portal-account lookup failed", {
      applicationId,
      deletionMode,
      code: portalError.code,
    });
    return { ok: false, message: "Portal access could not be checked, so deletion was stopped safely." };
  }

  if (documentError) {
    console.error("Intermediary deletion document lookup failed", {
      applicationId,
      deletionMode,
      code: documentError.code,
    });
    return { ok: false, message: "Stored documents could not be checked, so deletion was stopped safely." };
  }

  const authUserIds = Array.from(
    new Set((portalAccounts ?? []).map((row) => row.auth_user_id).filter((value): value is string => Boolean(value))),
  );

  let deletedAuthUsers = 0;
  for (const authUserId of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error) {
      console.error("Intermediary deletion auth cleanup failed", {
        applicationId,
        deletionMode,
        authUserId,
        deletedAuthUsers,
        message: error.message,
      });
      return {
        ok: false,
        message: deletedAuthUsers
          ? "Some portal access was removed, but the account records were not deleted. Please try again before recreating portal access."
          : "Portal access could not be removed, so account deletion was stopped safely.",
      };
    }
    deletedAuthUsers += 1;
  }

  const { error: deletionError } = await admin.rpc("delete_intermediary_account_v1", {
    p_application_id: applicationId,
    p_deletion_mode: deletionMode,
    p_actor_id: reviewer.id,
    p_auth_user_ids: authUserIds,
  });

  if (deletionError) {
    console.error("Atomic intermediary account deletion failed", {
      applicationId,
      deletionMode,
      code: deletionError.code,
      deletedAuthUsers,
      message: deletionError.message,
    });
    return {
      ok: false,
      message: deletedAuthUsers
        ? "Portal access was removed, but the account records could not be deleted. Please try the deletion again."
        : "The account could not be deleted. No database records were removed.",
    };
  }

  const cleanupWarning = await removeStoredDocuments(admin, documents ?? [], applicationId, deletionMode);

  revalidatePath("/intermediaries");
  revalidatePath("/intermediaries/partner");
  revalidatePath("/intermediaries/posp");
  revalidatePath("/intermediaries/misp");
  revalidatePath("/customers/posp-misp");

  return {
    ok: true,
    redirectTo: deletionMode === "partner"
      ? "/intermediaries/partner?success=partner_deleted"
      : `/intermediaries/${accountContext}?success=linked_account_deleted`,
    cleanupWarning,
  };
}

async function resolveTargetApplicationIds(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  application: ApplicationRow,
  deletionMode: IntermediaryDeletionMode,
) {
  if (deletionMode === "child") return [application.id];

  const ids = new Set<string>([application.id]);
  if (application.partner_record_id) {
    const { data, error } = await admin
      .from("intermediary_onboarding_applications")
      .select("id")
      .eq("partner_record_id", application.partner_record_id)
      .returns<Array<{ id: string }>>();
    if (error) throw new Error("Partner-linked applications could not be loaded.");
    for (const row of data ?? []) ids.add(row.id);
  }

  const { data: draftLinked, error: draftLinkedError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id")
    .contains("draft_data", { parent_partner_application_id: application.id })
    .returns<Array<{ id: string }>>();
  if (draftLinkedError) throw new Error("Partner-linked applications could not be loaded.");
  for (const row of draftLinked ?? []) ids.add(row.id);

  return Array.from(ids);
}

async function removeStoredDocuments(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  documents: StoredDocument[],
  applicationId: string,
  deletionMode: IntermediaryDeletionMode,
) {
  const byBucket = new Map<string, string[]>();
  for (const document of documents) {
    if (!document.storage_bucket || !document.storage_path) continue;
    const paths = byBucket.get(document.storage_bucket) ?? [];
    paths.push(document.storage_path);
    byBucket.set(document.storage_bucket, paths);
  }

  let cleanupWarning = false;
  for (const [bucket, paths] of byBucket) {
    const { error } = await admin.storage.from(bucket).remove(Array.from(new Set(paths)));
    if (error) {
      cleanupWarning = true;
      console.error("Deleted intermediary storage cleanup failed", {
        applicationId,
        deletionMode,
        bucket,
        message: error.message,
      });
    }
  }
  return cleanupWarning;
}

function readAccountContext(draftData: Record<string, unknown> | null) {
  const value = draftData?.account_context;
  return value === "posp" || value === "misp" ? value : "partner";
}
