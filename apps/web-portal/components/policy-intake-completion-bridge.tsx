"use client";

import { useEffect } from "react";
import { completePolicyIntakeByPolicyCode } from "@/app/policy-intakes/actions";

const KEY = "insureit:policy-intake:pending:v1";

export function PolicyIntakeCompletionBridge({ policyCode }: { policyCode?: string | null }) {
  useEffect(() => {
    if (!policyCode) return;
    let pending: { id?: string; savedAt?: number } | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { pending = null; }
    if (!pending?.id || !pending.savedAt || Date.now() - pending.savedAt > 8 * 60 * 60 * 1000) {
      try { sessionStorage.removeItem(KEY); } catch {}
      return;
    }
    void completePolicyIntakeByPolicyCode(pending.id, policyCode).then((result) => {
      if (result.ok) try { sessionStorage.removeItem(KEY); } catch {}
    });
  }, [policyCode]);
  return null;
}
