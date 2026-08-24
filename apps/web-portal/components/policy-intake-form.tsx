"use client";

import { Camera, CheckCircle2, FileText, Search, ShieldCheck, UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPolicyIntake } from "@/app/policy-intakes/actions";
import type { PolicyIntakeSource } from "@/lib/policy-intake-server";

export function PolicyIntakeForm({ sources }: { sources: PolicyIntakeSource[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitPolicyIntake(formData);
      if (!result.ok) { setError(result.error); return; }
      formRef.current?.reset();
      router.push(`/policy-intakes/${result.id}?submitted=1`);
      router.refresh();
    });
  }

  return <form ref={formRef} action={submit} className="mx-auto max-w-[560px] pb-24">
    <section className="overflow-hidden rounded-[24px] border border-[#DCE5F1] bg-white shadow-[0_18px_50px_rgba(31,56,96,.10)]">
      <div className="bg-[linear-gradient(135deg,#071D49,#174B83)] px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><ShieldCheck className="h-5 w-5" /></span>
          <div><h1 className="text-[17px] font-bold">New Policy Intake</h1><p className="mt-0.5 text-[10px] text-white/72">Three details. Operations completes the onboarding.</p></div>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]"><Search className="h-3.5 w-3.5" />Lead source</span>
          <select name="lead_source_id" required className="h-12 w-full rounded-2xl border border-[#D6DFEA] bg-white px-3 text-[12px] font-semibold text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]">
            <option value="">Select assigned Partner / POSP / MISP</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.intermediary_type.toUpperCase()} · {source.display_name}{source.intermediary_code ? ` · ${source.intermediary_code}` : ""}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]">Customer mobile</span>
          <input name="customer_mobile" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 digit mobile number" className="h-12 w-full rounded-2xl border border-[#D6DFEA] px-3 text-[14px] font-semibold tracking-[.03em] text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" />
        </label>
        <label className="group block cursor-pointer">
          <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]">Policy copy</span>
          <span className="flex min-h-[126px] items-center justify-center rounded-[20px] border border-dashed border-[#AFC2D9] bg-[#F7FAFE] px-5 text-center transition group-hover:border-[#5B7DA8] group-hover:bg-[#F2F7FD]">
            <span><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#E6F7F5] text-[#13877F]"><UploadCloud className="h-5 w-5" /></span><span className="mt-2 block text-[11px] font-bold text-[#17365D]">{fileName || "Upload policy PDF or image"}</span><span className="mt-1 flex items-center justify-center gap-2 text-[9px] text-[#7A8798]"><Camera className="h-3.5 w-3.5" />Camera or file · max 15 MB</span></span>
          </span>
          <input name="policy_document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
        </label>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] font-semibold text-red-700">{error}</div> : null}
        <button disabled={pending || !sources.length} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#17365D] text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.20)] disabled:opacity-50">
          {pending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Reading policy…</> : <><FileText className="h-4 w-4" />Submit Policy Intake</>}
        </button>
        <div className="flex items-start gap-2 rounded-xl bg-[#F4F8FC] px-3 py-2.5 text-[9px] leading-4 text-[#667085]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#159566]" />OCR proposes the details. Operations verifies everything before a policy is created.</div>
      </div>
    </section>
  </form>;
}
