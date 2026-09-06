export type PartnerPolicyIntakeSource = {
  id: string;
  intermediary_type: "partner" | "posp" | "misp";
  display_name: string;
  intermediary_code: string | null;
  account_status: string;
};

export type PartnerPolicyIntakeField = {
  key: string;
  label: string;
  value: string;
  confidence?: number | null;
};

export type PartnerPolicyIntake = {
  id: string;
  intake_number: string;
  status: string;
  lead_source_name: string;
  lead_source_type: string;
  lead_source_code: string | null;
  customer_mobile: string;
  file_name: string;
  ocr_status: string;
  ocr_fields: PartnerPolicyIntakeField[];
  attention_reason: string | null;
  created_at: string;
  updated_at: string;
  final_policy_id: string | null;
};

export type PartnerPolicyIntakeListResponse = {
  ok: true;
  intakes: PartnerPolicyIntake[];
  total: number;
  counts: {
    active: number;
    attention: number;
    progress: number;
    completed: number;
  };
};

export type PartnerPolicyIntakeSourcesResponse = {
  ok: true;
  sources: PartnerPolicyIntakeSource[];
};

type PreparedUpload = {
  ok: true;
  id: string;
  number: string;
  storage_path: string;
  signed_url: string;
};

export type IntakeProgress = {
  stage: "preparing" | "uploading" | "submitting";
  percent?: number;
};

export const MAX_POLICY_INTAKE_FILE_SIZE = 15 * 1024 * 1024;
export const POLICY_INTAKE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export async function getPartnerPolicyIntakesWeb({
  limit = 25,
  offset = 0,
  filter = "all",
}: {
  limit?: number;
  offset?: number;
  filter?: "all" | "attention" | "in_progress" | "completed";
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    filter,
  });
  return apiRequest<PartnerPolicyIntakeListResponse>("/api/partner/policy-intakes?" + params.toString());
}

export async function getPartnerPolicyIntakeSourcesWeb() {
  return apiRequest<PartnerPolicyIntakeSourcesResponse>("/api/partner/policy-intakes?view=sources");
}

export type PartnerPolicyIntakeDetailResponse = {
  ok: true;
  intake: PartnerPolicyIntake;
};

export async function getPartnerPolicyIntakeWeb(id: string) {
  return apiRequest<PartnerPolicyIntakeDetailResponse>("/api/partner/policy-intakes?id=" + encodeURIComponent(id));
}

export async function submitPartnerPolicyIntakeWeb(input: {
  leadSourceId?: string;
  customerMobile: string;
  file: File;
  onProgress?: (progress: IntakeProgress) => void;
}) {
  const meta = fileMeta(input.file);
  input.onProgress?.({ stage: "preparing" });

  const prepared = await apiRequest<PreparedUpload>("/api/partner/policy-intakes", {
    method: "POST",
    body: JSON.stringify({
      action: "prepare",
      lead_source_id: input.leadSourceId,
      customer_mobile: input.customerMobile,
      file: meta,
    }),
  });

  input.onProgress?.({ stage: "uploading", percent: 0 });
  await uploadSigned(prepared.signed_url, input.file, (percent) => {
    input.onProgress?.({ stage: "uploading", percent });
  });

  input.onProgress?.({ stage: "submitting" });
  return apiRequest<{ ok: true; id: string; number: string; status: "processing" }>("/api/partner/policy-intakes", {
    method: "POST",
    body: JSON.stringify({
      action: "complete",
      id: prepared.id,
      number: prepared.number,
      lead_source_id: input.leadSourceId,
      customer_mobile: input.customerMobile,
      storage_path: prepared.storage_path,
      file: meta,
    }),
  });
}

export async function linkExternalRenewalPolicyIntakeWeb(input: {
  opportunityId: string;
  intakeId: string;
}) {
  return apiRequest<{ ok: true; link: { opportunity_id: string; intake_id: string; linked: boolean } }>(
    "/api/partner/external-renewals/" + encodeURIComponent(input.opportunityId) + "/policy-intake",
    {
      method: "POST",
      body: JSON.stringify({ intake_id: input.intakeId }),
    },
  );
}

export async function submitPartnerPolicyIntakeReplacementWeb(input: {
  intakeId: string;
  file: File;
  onProgress?: (progress: IntakeProgress) => void;
}) {
  const meta = fileMeta(input.file);
  input.onProgress?.({ stage: "preparing" });

  const prepared = await apiRequest<PreparedUpload>("/api/partner/policy-intakes", {
    method: "POST",
    body: JSON.stringify({
      action: "prepare_response",
      id: input.intakeId,
      file: meta,
    }),
  });

  input.onProgress?.({ stage: "uploading", percent: 0 });
  await uploadSigned(prepared.signed_url, input.file, (percent) => {
    input.onProgress?.({ stage: "uploading", percent });
  });

  input.onProgress?.({ stage: "submitting" });
  return apiRequest<{ ok: true; id: string; number: string; status: "processing" }>("/api/partner/policy-intakes", {
    method: "POST",
    body: JSON.stringify({
      action: "complete_response",
      id: input.intakeId,
      storage_path: prepared.storage_path,
      file: meta,
    }),
  });
}

export function validatePolicyIntakeFile(file: File) {
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) return "Upload a PDF, JPG, PNG or WebP policy copy.";
  if (!file.size) return "The selected file is empty.";
  if (file.size > MAX_POLICY_INTAKE_FILE_SIZE) return "Policy copy must be 15 MB or smaller.";
  return null;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as ({ ok?: boolean; error?: string } & Partial<T>) | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Policy Intake request failed.");
  return payload as T;
}

function fileMeta(file: File) {
  return { name: file.name, type: file.type || "application/octet-stream", size: file.size || 0 };
}

async function uploadSigned(signedUrl: string, file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append("cacheControl", "3600");
  formData.append("", file);

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress?.(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
    };
    request.onerror = () => reject(new Error("The policy copy could not be uploaded. Check your connection and try again."));
    request.ontimeout = () => reject(new Error("The policy copy upload timed out. Please try again."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error("The policy copy could not be uploaded."));
      }
    };
    request.timeout = 120000;
    request.send(formData);
  });
}
