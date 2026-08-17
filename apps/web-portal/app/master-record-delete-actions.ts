"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DeletableMasterEntity = "customer" | "vehicle" | "policy" | "external_policy" | "claim";
export type MasterRecordDeleteResult = { ok: true } | { ok: false; error: string };

type Dependency = {
  table: "vehicles" | "policies" | "claims";
  column: "customer_id" | "vehicle_id" | "policy_id" | "external_policy_id";
  label: string;
};

const entityConfig: Record<DeletableMasterEntity, {
  table: "customers" | "vehicles" | "policies" | "external_policies" | "claims";
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
    revalidate: ["/policies", "/claims"],
    dependencies: [
      { table: "claims", column: "policy_id", label: "claim" }
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

export async function deleteMasterRecord(entity: DeletableMasterEntity, id: string): Promise<MasterRecordDeleteResult> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || profile.role !== "it_super_user") {
    return { ok: false, error: "Only the IT Super User can permanently delete customer, vehicle, policy, external policy or claim records." };
  }

  if (!(entity in entityConfig) || !isUuid(id)) {
    return { ok: false, error: "Invalid delete request." };
  }

  const config = entityConfig[entity];
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from(config.table)
    .select("id")
    .eq("id", id)
    .maybeSingle<{ id: string }>();

  if (existingError) return { ok: false, error: `Unable to verify the ${config.label}: ${existingError.message}` };
  if (!existing) return { ok: false, error: `This ${config.label} no longer exists.` };

  for (const dependency of config.dependencies) {
    const { count, error } = await admin
      .from(dependency.table)
      .select("id", { count: "exact", head: true })
      .eq(dependency.column, id);

    if (error) return { ok: false, error: `Unable to check linked ${pluralize(dependency.label, 2)}: ${error.message}` };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Cannot delete this ${config.label}. It is linked to ${count} ${pluralize(dependency.label, count ?? 0)}. Remove the linked record(s) first.`
      };
    }
  }

  const claimFiles: Array<{ storage_bucket: string; storage_path: string }> = [];
  if (entity === "claim") {
    const { data: documents, error: documentsError } = await admin
      .from("claim_documents")
      .select("storage_bucket, storage_path")
      .eq("claim_id", id)
      .returns<Array<{ storage_bucket: string; storage_path: string }>>();

    if (documentsError) {
      return { ok: false, error: `Unable to verify linked claim documents: ${documentsError.message}` };
    }
    claimFiles.push(...(documents ?? []).filter((document) => document.storage_bucket && document.storage_path));
  }

  const { error: deleteError } = await admin.from(config.table).delete().eq("id", id);
  if (deleteError) {
    const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
    return {
      ok: false,
      error: referenced
        ? `Cannot delete this ${config.label} because another record still references it.`
        : `Unable to delete the ${config.label}: ${deleteError.message}`
    };
  }

  if (entity === "claim" && claimFiles.length) {
    const filesByBucket = new Map<string, string[]>();
    for (const file of claimFiles) {
      const paths = filesByBucket.get(file.storage_bucket) ?? [];
      paths.push(file.storage_path);
      filesByBucket.set(file.storage_bucket, paths);
    }
    await Promise.allSettled(
      Array.from(filesByBucket.entries()).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths))
    );
  }

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: `delete_${entity}`,
    table_name: config.table,
    record_id: id,
    old_data: {
      id,
      deletion_source: "it_super_user_master_data_control",
      ...(entity === "claim" ? { cascaded_claim_records: true, storage_files_cleanup_attempted: claimFiles.length } : {})
    }
  });

  config.revalidate.forEach((path) => revalidatePath(path));
  return { ok: true };
}
