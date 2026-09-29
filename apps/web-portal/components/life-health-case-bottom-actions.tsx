"use client";

import Link from "next/link";

export function LifeHealthCaseBottomActions() {
  function createPolicyAndCloseCase() {
    const originalAction = document.querySelector<HTMLButtonElement>(".life-health-case-detail-actions aside button");
    originalAction?.click();
  }

  return (
    <section className="mt-4 flex items-center justify-end gap-2 border border-[#D9E2F0] bg-white px-4 py-3 shadow-sm">
      <Link href="/policies/life-health-cases" className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD7E7] bg-white px-5 text-[10px] font-semibold text-[#344054] transition hover:bg-[#F8FAFC]">
        Cancel
      </Link>
      <button type="button" onClick={createPolicyAndCloseCase} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white transition hover:bg-[#102A4A]">
        Create Policy &amp; Close Case
      </button>
    </section>
  );
}
