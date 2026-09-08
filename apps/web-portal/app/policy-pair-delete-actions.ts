"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type StorageFile = { storage_bucket: string; storage_path: string };
type CompletedIntakeRow = {
  id: string;
  intake_number: string;
  status: string;
  final_policy_id: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
};

type PairDeleteRpcResult = {
  policy_id: string;
  policy_no: string;
  policy_intake_id: string;
  policy_intake_number: string;
  rejected_policy_intake_links_cleared: number;
};

export type CoordinatedPolicyDeleteResult =
  | { ok: true; intakeNumber: string; storageCleanupFailed: number }
  | { ok: false; error: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueStorageFiles(files: StorageFile[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (!file.storage_bucket || !file.storage_path) return false;
    const key = `${file.storage_bucket}:${file.storage_path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function cleanupStorageFiles(admin: ReturnType<typeof createSupabaseAdminClient>, files: StorageFile[]) {
  const grouped = new Map<string, string[]>();
  for (const file of uniqueStorageFiles(files)) {
    const paths = grouped.get(file.storage_bucket) ?? [];
    paths.push(file.storage_path);
    grouped.set(file.storage_bucket, paths);
  }

  let failed = 0;
  for (const [bucket, paths] of grouped.entries()) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) failed += paths.length;
  }
  return failed;
}

function friendlyRpcError(message: string) {
  if (/claim\(s\)/i.test(message)) return message;
  if (/reconciliation record/i.test(message)) return message;
  if (/invoice line/i.test(message)) return message;
  if (/partner payable/i.test(message)) return message;
  if (/replacement audit/i.test(message)) return message;
  if (/another non-rejected policy intake/i.test(message)) return message;
  if (/official document on another policy/i.test(message)) return message;
  if (/not the completed intake/i.test(message)) return message;
  if (/changed while preparing deletion/i.test(message)) return message;
  return `Unable to delete the completed Policy + Policy Intake pair: ${message}`;
}

export async function deletePolicyWithCompletedIntake(policyId: string): Promise<CoordinatedPolicyDeleteResult> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || profile.role !== "it_super_user") {
    return { ok: false, error: "Only the IT Super User can permanently delete a completed Policy + Policy Intake pair." };
  }
  if (!isUuid(policyId)) {
    return { ok: false, error: "Invalid policy cleanup request." };
  }

  const admin = createSupabaseAdminClient();
  const { data: completedIntakes, error: intakeError } = await admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,final_policy_id,storage_bucket,storage_path")
    .eq("final_policy_id", policyId)
    .eq("status", "completed")
    .limit(2)
    .returns<CompletedIntakeRow[]>();

  if (intakeError) {
    return { ok: false, error: `Unable to verify the completed Policy Intake: ${intakeError.message}` };
  }
  if (!completedIntakes?.length) {
    return { ok: false, error: "This policy does not have a completed Policy Intake linked to it." };
  }
  if (completedIntakes.length !== 1) {
    return { ok: false, error: "This policy has multiple completed Policy Intakes linked to it. Review the records before deleting anything." };
  }

  const intake = completedIntakes[0];
  const [intakeDocumentsResult, policyDocumentsResult] = await Promise.all([
    admin
      .from("policy_intake_documents")
      .select("storage_bucket,storage_path")
      .eq("intake_id", intake.id)
      .returns<StorageFile[]>(),
    admin
      .from("policy_documents")
      .select("storage_bucket,storage_path")
      .eq("policy_id", policyId)
      .returns<StorageFile[]>(),
  ]);

  if (intakeDocumentsResult.error) {
    return { ok: false, error: `Unable to verify Policy Intake files: ${intakeDocumentsResult.error.message}` };
  }
  if (policyDocumentsResult.error) {
    return { ok: false, error: `Unable to verify Policy files: ${policyDocumentsResult.error.message}` };
  }

  const storageFiles: StorageFile[] = [];
  if (intake.storage_bucket && intake.storage_path) {
    storageFiles.push({ storage_bucket: intake.storage_bucket, storage_path: intake.storage_path });
  }
  storageFiles.push(...(intakeDocumentsResult.data ?? []));
  storageFiles.push(...(policyDocumentsResult.data ?? []));

  const { data, error } = await admin.rpc("delete_policy_with_completed_intake_pair", {
    p_policy_id: policyId,
    p_intake_id: intake.id,
    p_actor_id: profile.id,
  });

  if (error) {
    return { ok: false, error: friendlyRpcError(error.message) };
  }

  const rpcResult = data as PairDeleteRpcResult | null;
  const storageCleanupFailed = await cleanupStorageFiles(admin, storageFiles);

  if (storageCleanupFailed > 0) {
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "delete_policy_with_completed_intake_storage_cleanup_incomplete",
      table_name: "policies",
      record_id: policyId,
      old_data: {
        policy_id: policyId,
        policy_intake_id: intake.id,
        policy_intake_number: intake.intake_number,
        storage_cleanup_failed_files: storageCleanupFailed,
        storage_cleanup_attempted_files: uniqueStorageFiles(storageFiles).length,
      },
    });
  }

  ["/policies", "/policy-intakes", "/claims", "/accounts"].forEach((path) => revalidatePath(path));
  return {
    ok: true,
    intakeNumber: rpcResult?.policy_intake_number ?? intake.intake_number,
    storageCleanupFailed,
  };
}
