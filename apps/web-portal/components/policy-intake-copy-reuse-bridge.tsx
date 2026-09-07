"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { verifyPolicyIntakeCurrentPolicyCopy } from "@/app/policy-intakes/policy-copy-state-actions";

const KEY = "insureit:policy-intake:pending:v1";

function nudgePolicySaveConfirmation() {
  const marker = document.createElement("span");
  marker.hidden = true;
  marker.dataset.policyIntakeCopyReady = "true";
  document.body.appendChild(marker);
  queueMicrotask(() => marker.remove());
}

export function PolicyIntakeCopyReuseBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const intakeId = pathname === "/policies/new" ? searchParams.get("intake_id")?.trim() ?? "" : "";

  useEffect(() => {
    if (!intakeId || typeof window === "undefined") return;
    let cancelled = false;

    void verifyPolicyIntakeCurrentPolicyCopy(intakeId).then((result) => {
      if (cancelled || !result.ok) return;
      sessionStorage.setItem(KEY, JSON.stringify({ id: result.intakeId, savedAt: Date.now(), policyCopyDocumentId: result.documentId, fileName: result.fileName }));
      nudgePolicySaveConfirmation();
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      try {
        const pending = JSON.parse(sessionStorage.getItem(KEY) || "null") as { id?: string } | null;
        if (pending?.id === intakeId) sessionStorage.removeItem(KEY);
      } catch {
        sessionStorage.removeItem(KEY);
      }
    };
  }, [intakeId]);

  return null;
}
