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
  let parentApplicationId: string | null = null;
  try {
    if (deletionMode === "child") {
      parentApplicationId = await resolveParentApplicationId(admin, application);
    }
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

  let removedPortalUsers = 0;
  for (const authUserId of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error && !isMissingAuthUser(error.message)) {
      console.error("Intermediary deletion auth cleanup failed", {
        applicationId,
        deletionMode,
        authUserId,
        removedPortalUsers,
        message: error.message,
      });
      return {
        ok: false,
        message: removedPortalUsers
          ? "Some portal access was removed, but the account records were not deleted. Please try again before recreating portal access."
          : "Portal access could not be removed, so account deletion was stopped safely.",
      };
    }
    removedPortalUsers += 1;
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
      removedPortalUsers,
      message: deletionError.message,
    });
    return {
      ok: false,
      message: removedPortalUsers
        ? "Portal access was removed, but the account records could not be deleted. Please try the deletion again."
        : "The account could not be deleted. No database records were removed.",
    };
  }

  const storageCleanupWarning = await removeStoredDocuments(admin, documents ?? [], applicationId, deletionMode);
  const parentPreservationWarning = parentApplicationId
    ? await verifyParentPreserved(admin, parentApplicationId, applicationId)
    : false;
  const cleanupWarning = storageCleanupWarning || parentPreservationWarning;

  revalidatePath("/intermediaries");
  revalidatePath("/intermediaries/partner");
  revalidatePath("/intermediaries/posp");
  revalidatePath("/intermediaries/misp");
  revalidatePath("/customers/posp-misp");
  if (parentApplicationId) revalidatePath(`/intermediaries/applications/${parentApplicationId}`);

  return {
    ok: true,
    redirectTo: deletionMode === "partner"
      ? "/intermediaries/partner?success=partner_deleted"
      : parentApplicationId
        ? `/intermediaries/applications/${parentApplicationId}?success=linked_account_deleted`
        : "/intermediaries?success=linked_account_deleted",
    cleanupWarning,
  };
}

async function resolveParentApplicationId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  application: ApplicationRow,
) {
  const explicitParentId = textValue(application.draft_data?.parent_partner_application_id);
  if (explicitParentId) {
    const { data, error } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data")
      .eq("id", explicitParentId)
      .maybeSingle<{ id: string; draft_data: Record<string, unknown> | null }>();
    if (error) throw new Error("The parent Partner application could not be loaded.");
    if (data && readAccountContext(data.draft_data) === "partner") return data.id;
  }

  if (application.partner_record_id) {
    const { data, error } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data")
      .eq("partner_record_id", application.partner_record_id)
      .neq("id", application.id)
      .order("created_at", { ascending: true })
      .returns<Array<{ id: string; draft_data: Record<string, unknown> | null }>>();
    if (error) throw new Error("The parent Partner application could not be loaded.");
    const parent = (data ?? []).find((row) => readAccountContext(row.draft_data) === "partner");
    if (parent) return parent.id;
  }

  throw new Error("The linked Partner record could not be resolved.");
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
  const uniqueDocuments = new Map<string, StoredDocument>();
  for (const document of documents) {
    if (!document.storage_bucket || !document.storage_path) continue;
    uniqueDocuments.set(`${document.storage_bucket}\u0000${document.storage_path}`, document);
  }

  let cleanupWarning = false;
  for (const document of uniqueDocuments.values()) {
    const { count, error: referenceError } = await admin
      .from("intermediary_onboarding_documents")
      .select("id", { count: "exact", head: true })
      .eq("storage_bucket", document.storage_bucket)
      .eq("storage_path", document.storage_path);

    if (referenceError) {
      cleanupWarning = true;
      console.error("Deleted intermediary storage reference check failed", {
        applicationId,
        deletionMode,
        bucket: document.storage_bucket,
        path: document.storage_path,
        code: referenceError.code,
      });
      continue;
    }

    if ((count ?? 0) > 0) continue;

    const { error } = await admin.storage.from(document.storage_bucket).remove([document.storage_path]);
    if (error) {
      cleanupWarning = true;
      console.error("Deleted intermediary storage cleanup failed", {
        applicationId,
        deletionMode,
        bucket: document.storage_bucket,
        path: document.storage_path,
        message: error.message,
      });
    }
  }
  return cleanupWarning;
}

async function verifyParentPreserved(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  parentApplicationId: string,
  deletedChildApplicationId: string,
) {
  const [{ data: parentApplication, error: applicationError }, { data: parentProfile, error: profileError }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,partner_status")
      .eq("id", parentApplicationId)
      .maybeSingle<{ id: string; partner_record_id: string | null; partner_status: string | null }>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,partner_id,associate_name")
      .eq("application_id", parentApplicationId)
      .maybeSingle<{ application_id: string; partner_id: string | null; associate_name: string | null }>(),
  ]);

  if (!applicationError && !profileError && parentApplication && parentProfile) return false;

  console.error("Parent Partner preservation verification failed after child deletion", {
    parentApplicationId,
    deletedChildApplicationId,
    applicationCode: applicationError?.code,
    profileCode: profileError?.code,
    applicationFound: Boolean(parentApplication),
    profileFound: Boolean(parentProfile),
  });
  return true;
}

function readAccountContext(draftData: Record<string, unknown> | null) {
  const value = draftData?.account_context;
  return value === "posp" || value === "misp" ? value : "partner";
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isMissingAuthUser(message: string) {
  return /user.*not found|not found.*user/i.test(message);
}
