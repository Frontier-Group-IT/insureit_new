import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PolicySourceInput = {
  intermediaryType?: string | null;
  intermediaryCode?: string | null;
  leadSource?: string | null;
};

type IntermediaryRow = {
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
};

export type ResolvedPolicySource = {
  intermediaryType: "POSP" | "MISP" | "SIBL / Partner";
  intermediaryCode: string;
  leadSource: string;
};

const typeToDatabase = {
  POSP: "posp",
  MISP: "misp",
  "SIBL / Partner": "partner",
} as const;

export async function resolvePolicyIntermediarySource(
  input: PolicySourceInput,
): Promise<{ ok: true; source: ResolvedPolicySource } | { ok: false; error: string }> {
  const intermediaryType = String(input.intermediaryType ?? "").trim() as keyof typeof typeToDatabase;
  const intermediaryCode = String(input.intermediaryCode ?? "").trim();

  if (!(intermediaryType in typeToDatabase) || !intermediaryCode) {
    return { ok: false, error: "Select a valid active Partner/POSP/MISP as the Lead Source." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intermediaries")
    .select("intermediary_type,display_name,intermediary_code")
    .eq("intermediary_type", typeToDatabase[intermediaryType])
    .eq("intermediary_code", intermediaryCode)
    .eq("account_status", "active")
    .limit(2)
    .returns<IntermediaryRow[]>();

  if (error) return { ok: false, error: `Unable to validate the Lead Source: ${error.message}` };
  if (!data || data.length !== 1 || !data[0].display_name?.trim() || !data[0].intermediary_code?.trim()) {
    return { ok: false, error: "Select a valid active Partner/POSP/MISP as the Lead Source." };
  }

  return {
    ok: true,
    source: {
      intermediaryType,
      intermediaryCode: data[0].intermediary_code.trim(),
      leadSource: data[0].display_name.trim(),
    },
  };
}
