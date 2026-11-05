"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { saveCustomerExternalInsurerClaimNumber } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";

export function CustomerInsurerClaimNumberPopup({
  accountId, claimId, destination,
}: {
  accountId: string; claimId: string; destination: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [claimNumber, setClaimNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closedRef = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);
  const close = () => {
    if (saving || closedRef.current) return;
    closedRef.current = true;
    setOpen(false);
    router.replace(destination);
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const continueToStage = async () => {
    if (saving) return;
    const value = claimNumber.trim();
    if (!value) {
      setError("Enter the insurer claim number, or select Not now.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await saveCustomerExternalInsurerClaimNumber(accountId, claimId, value);
      if (result.error) {
        setError(result.error);
      } else {
        closedRef.current = true;
        setOpen(false);
        router.replace(destination);
        router.refresh();
      }
    } catch {
      setError("Unable to save the insurer claim number. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#061632]/65 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="insurer-claim-number-heading"
        aria-describedby="insurer-claim-number-description"
        className="w-full max-w-[390px] rounded-[25px] bg-white px-5 pb-5 pt-6 shadow-[0_28px_70px_rgba(0,20,55,.28)] sm:px-6">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-[#D9E7F8] bg-[#F0F7FF] text-[#1756A8]">
          <ShieldCheck className="h-9 w-9" strokeWidth={1.8} aria-hidden="true"/>
        </div>
        <h2 id="insurer-claim-number-heading" className="text-center text-[18px] font-extrabold text-[#0A2145]">
          Add insurer claim number?
        </h2>
        <p id="insurer-claim-number-description" className="mt-2 text-center text-[12px] text-[#657590]">
          Optional — add it now or continue to Work Approval.
        </p>
        <div className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-[#2465AD] px-3 focus-within:ring-2 focus-within:ring-[#B7D6FF]">
          <FileText className="h-5 w-5 shrink-0 text-[#1C5DA9]" aria-hidden="true"/>
          <input ref={inputRef} type="text" value={claimNumber} maxLength={80} autoComplete="off"
            aria-label="Insurer claim number" aria-invalid={Boolean(error)}
            placeholder="Enter claim number"
            onChange={event => {setClaimNumber(event.target.value);setError("");}}
            onKeyDown={event => {if (event.key === "Enter") {event.preventDefault();void continueToStage();}}}
            className="w-full min-w-0 bg-transparent py-3 text-[13px] font-medium text-[#0A2145] outline-none placeholder:text-[#64748B]" />
        </div>
        {error ? <p role="alert" className="mt-2 text-[12px] text-[#B42318]">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={close} disabled={saving}
            className="min-h-12 rounded-xl border border-[#1D538D] bg-white text-[13px] font-bold text-[#183C69] hover:bg-[#F1F6FD] focus-visible:outline-2 focus-visible:outline-[#1D538D] disabled:opacity-60">
            Not now
          </button>
          <button type="button" onClick={() => void continueToStage()} disabled={saving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1047A3] px-3 text-[13px] font-bold text-white hover:bg-[#0B377D] focus-visible:outline-2 focus-visible:outline-[#1047A3] disabled:opacity-60">
            {saving ? "Saving..." : "Continue"} <ArrowRight className="h-5 w-5" aria-hidden="true"/>
          </button>
        </div>
      </section>
    </div>
  );
}
