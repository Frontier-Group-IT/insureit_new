"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { preparePolicyIntakeHandoff } from "@/app/policy-intakes/handoff-actions";

const POLICY_DRAFT_KEY = "insureit:policy-onboarding:draft:v2";
const POLICY_INTAKE_PENDING_KEY = "insureit:policy-intake:pending:v1";

export function PolicyIntakeHandoffButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function continueToOnboarding() {
    setError(null);
    startTransition(async () => {
      const result = await preparePolicyIntakeHandoff(id);
      if (!result.ok) { setError(result.error); return; }
      try {
        const { registrationMode, ...form } = result.draft;
        sessionStorage.setItem(POLICY_DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), form, registrationMode }));
        sessionStorage.setItem(POLICY_INTAKE_PENDING_KEY, JSON.stringify({ id, savedAt: Date.now() }));
      } catch {
        setError("This browser could not prepare the onboarding draft. Please refresh and try again.");
        return;
      }
      router.push("/policies/new");
    });
  }

  return <div className="space-y-2">
    <button type="button" disabled={pending} onClick={continueToOnboarding} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#17365D] text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.20)] disabled:opacity-60">
      <CheckCircle2 className="h-4 w-4" />{pending ? "Preparing…" : "Review & Finalize"}<ArrowRight className="h-4 w-4" />
    </button>
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{error}</p> : null}
  </div>;
}
