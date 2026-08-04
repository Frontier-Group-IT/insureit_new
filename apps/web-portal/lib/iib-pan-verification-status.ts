export type IibPanVerificationJob = {
  status: string | null;
  result_code: string | null;
  result_message: string | null;
  last_error: string | null;
};

export type IibPanVerificationStatus = {
  code: "not_checked" | "queued" | "checking" | "cleared" | "matched" | "invalid" | "failed";
  label: string;
  detail: string | null;
  badgeClassName: string;
};

export function resolveIibPanVerificationStatus(
  job: IibPanVerificationJob | null | undefined,
  iibRemarks?: string | null,
): IibPanVerificationStatus {
  const status = normalize(job?.status);
  const result = normalize(job?.result_code);
  const effective = result || status;

  if (status === "pending" || status === "queued") {
    return value("queued", "Waiting in IIB queue", job?.result_message ?? null, "bg-amber-100 text-amber-800");
  }
  if (status === "checking") {
    return value("checking", "IIB check in progress", job?.result_message ?? null, "bg-sky-100 text-sky-800");
  }
  if (effective === "not_found") {
    return value("cleared", "IIB Cleared", job?.result_message ?? iibRemarks ?? null, "bg-emerald-100 text-emerald-700");
  }
  if (effective === "matched") {
    return value("matched", "IIB record found", job?.result_message ?? iibRemarks ?? null, "bg-rose-100 text-rose-700");
  }
  if (effective === "invalid" || effective === "stale_pan") {
    return value("invalid", effective === "stale_pan" ? "Fresh IIB check required" : "Invalid PAN", job?.last_error ?? job?.result_message ?? null, "bg-orange-100 text-orange-800");
  }
  if (effective === "failed") {
    return value("failed", "IIB check failed", job?.last_error ?? job?.result_message ?? null, "bg-red-100 text-red-700");
  }

  const remarks = normalizeMessage(iibRemarks);
  if (remarks.includes("no data found")) {
    return value("cleared", "IIB Cleared", iibRemarks ?? null, "bg-emerald-100 text-emerald-700");
  }
  if (remarks.includes("matching record found")) {
    return value("matched", "IIB record found", iibRemarks ?? null, "bg-rose-100 text-rose-700");
  }

  return value("not_checked", "IIB check not started", null, "bg-slate-100 text-slate-700");
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeMessage(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function value(
  code: IibPanVerificationStatus["code"],
  label: string,
  detail: string | null,
  badgeClassName: string,
): IibPanVerificationStatus {
  return { code, label, detail, badgeClassName };
}
