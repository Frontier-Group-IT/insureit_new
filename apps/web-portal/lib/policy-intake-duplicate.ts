import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RegisteredPolicyRow = {
  id: string;
  policy_no: string | null;
  policy_no_normalized: string | null;
  policy_code: string | null;
};

type HistoricalIntakeRow = {
  id: string;
  intake_number: string;
  created_at: string;
  ocr_fields: PolicyIntakeOcrField[] | null;
};

export type PolicyIntakeDuplicateCandidate = {
  id: string;
  intake_number: string;
  status: string;
  created_at: string;
  ocr_fields: PolicyIntakeOcrField[] | null;
};

export type PolicyIntakeDuplicateMatch =
  | {
      kind: "registered_policy";
      normalizedPolicyNumber: string;
      policyId: string;
      policyNumber: string;
      policyCode: string | null;
    }
  | {
      kind: "earlier_intake";
      normalizedPolicyNumber: string;
      intakeId: string;
      intakeNumber: string;
    };

export type PolicyIntakeDuplicateCheck =
  | { ok: true; matches: Map<string, PolicyIntakeDuplicateMatch> }
  | { ok: false; error: string };

export function normalizePolicyNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function policyNumberFromIntake(fields: PolicyIntakeOcrField[] | null | undefined) {
  const raw = fields?.find((item) => item.key === "policy_number")?.value?.trim() ?? "";
  return normalizePolicyNumber(raw);
}

export async function loadPolicyIntakeDuplicateMatches(
  admin: AdminClient,
  candidates: PolicyIntakeDuplicateCandidate[],
): Promise<PolicyIntakeDuplicateCheck> {
  const normalizedNumbers = Array.from(
    new Set(
      candidates
        .filter((row) => row.status !== "completed")
        .map((row) => policyNumberFromIntake(row.ocr_fields))
        .filter(Boolean),
    ),
  );

  if (!normalizedNumbers.length) return { ok: true, matches: new Map() };

  const [policyResult, intakeResult] = await Promise.all([
    admin
      .from("policies")
      .select("id,policy_no,policy_no_normalized,policy_code")
      .in("policy_no_normalized", normalizedNumbers)
      .returns<RegisteredPolicyRow[]>(),
    admin
      .from("policy_intake_requests")
      .select("id,intake_number,created_at,ocr_fields")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(5000)
      .returns<HistoricalIntakeRow[]>(),
  ]);

  if (policyResult.error || intakeResult.error) {
    return { ok: false, error: "Policy duplicate protection is temporarily unavailable." };
  }

  const registeredPolicyByNumber = new Map<string, RegisteredPolicyRow>();
  for (const policy of policyResult.data ?? []) {
    const normalized = normalizePolicyNumber(policy.policy_no_normalized ?? policy.policy_no ?? "");
    if (normalized && !registeredPolicyByNumber.has(normalized)) {
      registeredPolicyByNumber.set(normalized, policy);
    }
  }

  const firstIntakeByPolicyNumber = new Map<string, HistoricalIntakeRow>();
  for (const intake of intakeResult.data ?? []) {
    const normalized = policyNumberFromIntake(intake.ocr_fields);
    if (normalized && !firstIntakeByPolicyNumber.has(normalized)) {
      firstIntakeByPolicyNumber.set(normalized, intake);
    }
  }

  const matches = new Map<string, PolicyIntakeDuplicateMatch>();
  for (const candidate of candidates) {
    if (candidate.status === "completed") continue;
    const normalized = policyNumberFromIntake(candidate.ocr_fields);
    if (!normalized) continue;

    const registeredPolicy = registeredPolicyByNumber.get(normalized);
    if (registeredPolicy) {
      matches.set(candidate.id, {
        kind: "registered_policy",
        normalizedPolicyNumber: normalized,
        policyId: registeredPolicy.id,
        policyNumber: registeredPolicy.policy_no?.trim() || normalized,
        policyCode: registeredPolicy.policy_code,
      });
      continue;
    }

    const firstIntake = firstIntakeByPolicyNumber.get(normalized);
    if (firstIntake && firstIntake.id !== candidate.id) {
      matches.set(candidate.id, {
        kind: "earlier_intake",
        normalizedPolicyNumber: normalized,
        intakeId: firstIntake.id,
        intakeNumber: firstIntake.intake_number,
      });
    }
  }

  return { ok: true, matches };
}
