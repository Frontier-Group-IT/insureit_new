"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { classifyPolicyIntakeDeleteLinks, type LinkedPolicyIntake } from "@/lib/policy-delete-guard";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DeletableMasterEntity = "customer" | "customer_onboarding_application" | "vehicle" | "policy" | "policy_intake" | "external_policy" | "claim";
export type MasterRecordDeleteResult = { ok: true } | { ok: false; error: string };

type Dependency = {
  table: "vehicles" | "policies" | "claims" | "reconciliation_lines" | "accounts_invoice_lines" | "partner_payables" | "policy_intake_requests" | "policy_documents";
  column: "customer_id" | "vehicle_id" | "policy_id" | "external_policy_id" | "final_policy_id" | "source_intake_id";
  label: string;
};

const entityConfig: Record<DeletableMasterEntity, {
  table: "customers" | "customer_onboarding_applications" | "vehicles" | "policies" | "policy_intake_requests" | "external_policies" | "claims";
  label: string;
  revalidate: string[];
  dependencies: Dependency[];
}> = {
  customer: {
    table: "customers",
    label: "customer",
    revalidate: ["/customers", "/vehicles", "/policies", "/claims"],
    dependencies: [
      { table: "vehicles", column: "customer_id", label: "vehicle" },
      { table: "policies", column: "customer_id", label: "policy" },
      { table: "claims", column: "customer_id", label: "claim" }
    ]
  },
  customer_onboarding_application: {
    table: "customer_onboarding_applications",
    label: "onboarding application",
    revalidate: ["/customers/applications", "/customers"],
    dependencies: []
  },
  vehicle: {
    table: "vehicles",
    label: "vehicle",
    revalidate: ["/vehicles", "/policies", "/claims"],
    dependencies: [
      { table: "policies", column: "vehicle_id", label: "policy" },
      { table: "claims", column: "vehicle_id", label: "claim" }
    ]
  },
  policy: {
    table: "policies",
    label: "policy",
    revalidate: ["/policies", "/claims", "/accounts", "/policy-intakes"],
    dependencies: [
      { table: "claims", column: "policy_id", label: "claim" },
      { table: "reconciliation_lines", column: "policy_id", label: "reconciliation record" },
      { table: "accounts_invoice_lines", column: "policy_id", label: "invoice line" },
      { table: "partner_payables", column: "policy_id", label: "partner payable" },
      { table: "policy_intake_requests", column: "final_policy_id", label: "policy intake" }
    ]
  },
  policy_intake: {
    table: "policy_intake_requests",
    label: "policy intake",
    revalidate: ["/policy-intakes"],
    dependencies: [
      { table: "policy_documents", column: "source_intake_id", label: "official policy document" }
    ]
  },
  external_policy: {
    table: "external_policies",
    label: "external policy",
    revalidate: ["/policies/external", "/claims"],
    dependencies: [
      { table: "claims", column: "external_policy_id", label: "claim" }
    ]
  },
  claim: {
    table: "claims",
    label: "claim",
    revalidate: ["/claims", "/policies", "/vehicles", "/customers"],
    dependencies: []
  }
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pluralize(label: string, count: number) {
  return count === 1 ? label : `${label}s`;
}

function joinDependencyLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

type StorageFile = { storage_bucket: string; storage_path: string };

async function removeStorageFiles(admin: ReturnType<typeof createSupabaseAdminClient>, files: StorageFile[]) {
  if (!files.length) return;
  const filesByBucket = new Map<string, string[]>();
  for (const file of files) {
    const paths = filesByBucket.get(file.storage_bucket) ?? [];
    paths.push(file.storage_path);
    filesByBucket.set(file.storage_bucket, paths);
  }
  await Promise.allSettled(
    Array.from(filesByBucket.entries()).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths))
  );
}

async function restoreRejectedPolicyIntakeLinks(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  policyId: string,
  intakeIds: string[]
) {
  if (!intakeIds.length) return null;
  const { error } = await admin
    .from("policy_intake_requests")
    .update({ final_policy_id: policyId })
    .in("id", intakeIds)
    .eq("status", "rejected")
    .is("final_policy_id", null);
  return error;
}

export async function deleteMasterRecord(entity: DeletableMasterEntity, id: string): Promise<MasterRecordDeleteResult> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || profile.role !== "it_super_user") {
    return { ok: false, error: "Only the IT Super User can permanently delete customer, onboarding application, vehicle, policy, policy intake, external policy or claim records." };
  }

  if (!(entity in entityConfig) || !isUuid(id)) {
    return { ok: false, error: "Invalid delete request." };
  }

  const config = entityConfig[entity];
  const admin = createSupabaseAdminClient();

  // Preserve a human-readable claim origin before the permanent delete cascades
  // its claim record. The existing audit writer runs only after deletion.
  let deletedClaimIdentity: { claim_no: string | null; claim_created_by_name: string | null } | null = null;
  if (entity === "claim") {
    const { data: claim, error: claimError } = await admin.from("claims")
      .select("id,claim_no,created_by")
      .eq("id",id)
      .maybeSingle<{id:string;claim_no:string|null;created_by:string|null}>();
    if (claimError) return { ok:false, error:"Unable to verify the claim identity before deletion." };
    if (!claim) return { ok:false, error:"This claim no longer exists." };
    let creatorName:string|null = null;
    if (claim.created_by && isUuid(claim.created_by)) {
      const { data: creator, error: creatorError } = await admin.from("profiles")
        .select("full_name").eq("id",claim.created_by)
        .maybeSingle<{full_name:string|null}>();
      if (creatorError) return { ok:false, error:"Unable to verify the claim creator before deletion." };
      creatorName = creator?.full_name?.trim() || null;
    }
    deletedClaimIdentity = {claim_no:claim.claim_no,claim_created_by_name:creatorName};
  }

  // Preserve ONLY the labels needed by Daily Report while the policy and
  // its references still exist. A permanently deleted policy cannot be joined.
  let deletedPolicyIdentity: {
    policy_no: string | null; customer_name: string | null;
    vehicle_no: string | null; insurance_company_name: string | null;
  } | null = null;
  if (entity === "policy") {
    const { data: policy, error: policyError } = await admin.from("policies")
      .select("policy_no,policy_code,customer_id,vehicle_id,insurance_company_id")
      .eq("id",id).maybeSingle<{
        policy_no:string|null;policy_code:string|null;customer_id:string|null;
        vehicle_id:string|null;insurance_company_id:string|null;
      }>();
    if (policyError || !policy) return {ok:false,error:"Unable to verify the policy details before deletion."};

    const [customer, vehicle, insurer] = await Promise.all([
      policy.customer_id
        ? admin.from("customers").select("company_name,contact_name,legal_trade_name")
            .eq("id",policy.customer_id).maybeSingle<{
              company_name:string|null;contact_name:string|null;legal_trade_name:string|null;
            }>()
        : Promise.resolve({data:null,error:null}),
      policy.vehicle_id
        ? admin.from("vehicles").select("vehicle_no").eq("id",policy.vehicle_id)
            .maybeSingle<{vehicle_no:string|null}>()
        : Promise.resolve({data:null,error:null}),
      policy.insurance_company_id
        ? admin.from("insurance_companies").select("name").eq("id",policy.insurance_company_id)
            .maybeSingle<{name:string|null}>()
        : Promise.resolve({data:null,error:null}),
    ]);
    // Fail closed on lookup errors: do not destroy the source before preserving
    // the labels which were actually available.
    if (customer.error || vehicle.error || insurer.error)
      return {ok:false,error:"Unable to preserve the policy's customer, vehicle or insurer details. Nothing was deleted."};
    deletedPolicyIdentity = {
      policy_no:policy.policy_no?.trim() || policy.policy_code?.trim() || null,
      customer_name:customer.data?.company_name?.trim() || customer.data?.contact_name?.trim()
        || customer.data?.legal_trade_name?.trim() || null,
      vehicle_no:vehicle.data?.vehicle_no?.trim() || null,
      insurance_company_name:insurer.data?.name?.trim() || null,
    };
  }

  let linkedCustomerId: string | null = null;
  let linkedFinalPolicyId: string | null = null;
  let policyIntakeSourceFile: StorageFile | null = null;
  if (entity === "customer_onboarding_application") {
    const { data: existing, error: existingError } = await admin
      .from("customer_onboarding_applications")
      .select("id, customer_id")
      .eq("id", id)
      .maybeSingle<{ id: string; customer_id: string | null }>();

    if (existingError) return { ok: false, error: `Unable to verify the ${config.label}: ${existingError.message}` };
    if (!existing) return { ok: false, error: `This ${config.label} no longer exists.` };
    linkedCustomerId = existing.customer_id;
  } else if (entity === "policy_intake") {
    const { data: existing, error: existingError } = await admin
      .from("policy_intake_requests")
      .select("id, final_policy_id, storage_bucket, storage_path")
      .eq("id", id)
      .maybeSingle<{ id: string; final_policy_id: string | null; storage_bucket: string | null; storage_path: string | null }>();

    if (existingError) return { ok: false, error: `Unable to verify the ${config.label}: ${existingError.message}` };
    if (!existing) return { ok: false, error: `This ${config.label} no longer exists.` };
    linkedFinalPolicyId = existing.final_policy_id;
    if (existing.storage_bucket && existing.storage_path) {
      policyIntakeSourceFile = { storage_bucket: existing.storage_bucket, storage_path: existing.storage_path };
    }
  } else {
    const { data: existing, error: existingError } = await admin
      .from(config.table)
      .select("id")
      .eq("id", id)
      .maybeSingle<{ id: string }>();

    if (existingError) return { ok: false, error: `Unable to verify the ${config.label}: ${existingError.message}` };
    if (!existing) return { ok: false, error: `This ${config.label} no longer exists.` };
  }

  const dependencyBlocks: string[] = [];
  for (const dependency of config.dependencies) {
    if (entity === "policy" && dependency.table === "policy_intake_requests" && dependency.column === "final_policy_id") {
      continue;
    }

    const { count, error } = await admin
      .from(dependency.table)
      .select("id", { count: "exact", head: true })
      .eq(dependency.column, id);

    if (error) return { ok: false, error: `Unable to check linked ${pluralize(dependency.label, 2)}: ${error.message}` };
    if ((count ?? 0) > 0) {
      dependencyBlocks.push(`${count} ${pluralize(dependency.label, count ?? 0)}`);
    }
  }

  if (entity === "policy_intake" && linkedFinalPolicyId) {
    dependencyBlocks.push("1 final policy");
  }

  let rejectedPolicyIntakeIds: string[] = [];
  if (entity === "policy") {
    const { data: linkedIntakes, error: linkedIntakesError } = await admin
      .from("policy_intake_requests")
      .select("id, status")
      .eq("final_policy_id", id)
      .returns<LinkedPolicyIntake[]>();

    if (linkedIntakesError) {
      return { ok: false, error: `Unable to check linked policy intakes: ${linkedIntakesError.message}` };
    }

    const classification = classifyPolicyIntakeDeleteLinks(linkedIntakes ?? []);
    rejectedPolicyIntakeIds = classification.rejectedIds;
    if (classification.blockingCount > 0) {
      dependencyBlocks.push(`${classification.blockingCount} ${pluralize("policy intake", classification.blockingCount)}`);
    }
  }

  if (dependencyBlocks.length > 0) {
    return {
      ok: false,
      error: `Cannot delete this ${config.label}. It is linked to ${joinDependencyLabels(dependencyBlocks)}. Remove the linked record(s) first.`
    };
  }

  const storageFiles: StorageFile[] = [];
  if (entity === "claim") {
    const { data: documents, error: documentsError } = await admin
      .from("claim_documents")
      .select("storage_bucket, storage_path")
      .eq("claim_id", id)
      .returns<StorageFile[]>();

    if (documentsError) {
      return { ok: false, error: `Unable to verify linked claim documents: ${documentsError.message}` };
    }
    storageFiles.push(...(documents ?? []).filter((document) => document.storage_bucket && document.storage_path));
  }

  if (entity === "customer_onboarding_application") {
    const { data: documents, error: documentsError } = await admin
      .from("customer_onboarding_documents")
      .select("storage_bucket, storage_path")
      .eq("application_id", id)
      .returns<StorageFile[]>();

    if (documentsError) {
      return { ok: false, error: `Unable to verify linked onboarding documents: ${documentsError.message}` };
    }
    storageFiles.push(...(documents ?? []).filter((document) => document.storage_bucket && document.storage_path));
  }

  if (entity === "policy_intake") {
    const { data: documents, error: documentsError } = await admin
      .from("policy_intake_documents")
      .select("storage_bucket, storage_path")
      .eq("intake_id", id)
      .returns<StorageFile[]>();

    if (documentsError) {
      return { ok: false, error: `Unable to verify linked policy intake documents: ${documentsError.message}` };
    }
    if (policyIntakeSourceFile) storageFiles.push(policyIntakeSourceFile);
    storageFiles.push(...(documents ?? []).filter((document) => document.storage_bucket && document.storage_path));
  }

  let unlinkedRejectedPolicyIntakeIds: string[] = [];
  if (entity === "policy" && rejectedPolicyIntakeIds.length > 0) {
    const { data: unlinked, error: unlinkError } = await admin
      .from("policy_intake_requests")
      .update({ final_policy_id: null })
      .in("id", rejectedPolicyIntakeIds)
      .eq("status", "rejected")
      .eq("final_policy_id", id)
      .select("id")
      .returns<Array<{ id: string }>>();

    if (unlinkError) {
      return { ok: false, error: `Unable to release the rejected policy intake link: ${unlinkError.message}` };
    }

    unlinkedRejectedPolicyIntakeIds = (unlinked ?? []).map((row) => row.id);
    if (unlinkedRejectedPolicyIntakeIds.length !== rejectedPolicyIntakeIds.length) {
      await restoreRejectedPolicyIntakeLinks(admin, id, unlinkedRejectedPolicyIntakeIds);
      return {
        ok: false,
        error: "The rejected policy intake link changed while preparing deletion. Refresh and try again."
      };
    }
  }

  if (entity === "customer") {
    const { error: deleteError } = await admin.rpc("delete_customer_and_revoke_mobile_access", {
      p_customer_id: id,
      p_actor_id: profile.id
    });

    if (deleteError) {
      const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
      return {
        ok: false,
        error: referenced
          ? "Cannot delete this customer because another record still references it."
          : `Unable to delete the customer: ${deleteError.message}`
      };
    }
  } else if (entity === "policy_intake") {
    const { data: deleted, error: deleteError } = await admin
      .from("policy_intake_requests")
      .delete()
      .eq("id", id)
      .is("final_policy_id", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (deleteError) {
      const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
      return {
        ok: false,
        error: referenced
          ? "Cannot delete this policy intake because another record still references it."
          : `Unable to delete the policy intake: ${deleteError.message}`
      };
    }
    if (!deleted) {
      return {
        ok: false,
        error: "This policy intake changed while preparing deletion or now has a linked final policy. Refresh and try again."
      };
    }
  } else {
    const { error: deleteError } = await admin.from(config.table).delete().eq("id", id);
    if (deleteError) {
      const restoreError = entity === "policy"
        ? await restoreRejectedPolicyIntakeLinks(admin, id, unlinkedRejectedPolicyIntakeIds)
        : null;
      const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
      const baseError = referenced
        ? `Cannot delete this ${config.label} because another record still references it.`
        : `Unable to delete the ${config.label}: ${deleteError.message}`;
      return {
        ok: false,
        error: restoreError
          ? `${baseError} The rejected policy intake link could not be restored automatically; review the intake before retrying.`
          : baseError
      };
    }
  }

  await removeStorageFiles(admin, storageFiles);

  if (entity !== "customer") {
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: `delete_${entity}`,
      table_name: config.table,
      record_id: id,
      old_data: {
        id,
        deletion_source: "it_super_user_master_data_control",
        ...(entity === "claim" ? { cascaded_claim_records: true, storage_files_cleanup_attempted: storageFiles.length, claim_no: deletedClaimIdentity?.claim_no ?? null, claim_created_by_name: deletedClaimIdentity?.claim_created_by_name ?? null } : {}),
        ...(entity === "policy" ? { ...deletedPolicyIdentity, rejected_policy_intake_links_cleared: unlinkedRejectedPolicyIntakeIds.length } : {}),
        ...(entity === "policy_intake" ? {
          cascaded_policy_intake_records: true,
          storage_files_cleanup_attempted: storageFiles.length,
          linked_final_policy_preserved: false
        } : {}),
        ...(entity === "customer_onboarding_application" ? {
          cascaded_application_contacts_and_documents: true,
          storage_files_cleanup_attempted: storageFiles.length,
          linked_customer_preserved: Boolean(linkedCustomerId),
          linked_customer_id: linkedCustomerId
        } : {})
      }
    });
  }

  config.revalidate.forEach((path) => revalidatePath(path));
  return { ok: true };
}
