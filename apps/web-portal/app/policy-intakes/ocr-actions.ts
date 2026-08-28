"use server";

import { requireCapability } from "@/lib/master-data-server";
import {
  extractPolicyIntakeDocumentTrusted,
  type PolicyIntakeOcrField,
  type PolicyIntakeOcrResult,
} from "@/lib/policy-intake-ocr-service";

export type { PolicyIntakeOcrField, PolicyIntakeOcrResult };

export async function extractPolicyIntakeDocument(formData: FormData): Promise<PolicyIntakeOcrResult> {
  await requireCapability("create_policy_intakes", "edit");
  return extractPolicyIntakeDocumentTrusted(formData);
}
