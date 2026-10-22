"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";

export type PolicySaveState = {
  error: string | null;
  policyCreated: boolean;
};

const initialState: PolicySaveState = { error: null, policyCreated: false };

export function CustomerPolicySaveForm({
  action, accountId, children,
}: {
  action: (state: PolicySaveState, formData: FormData) => Promise<PolicySaveState>;
  accountId: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [portal, setPortal] = useState<Element | null>(null);
  const [summary, setSummary] = useState<Record<string,string>>({});
  useEffect(() => { setPortal(document.getElementById("customer-policy-live-summary")); }, []);
  function trackFields(form: HTMLFormElement) {
    const values = new FormData(form);
    const option = (name: string) => {
      const field = form.elements.namedItem(name);
      return field instanceof HTMLSelectElement ? field.selectedOptions[0]?.textContent || "" : String(values.get(name) || "");
    };
    setSummary({ vehicle: option("vehicle"), type: option("type"), insurer: option("insurer"), number: String(values.get("number") || ""), start: String(values.get("start") || ""), end: String(values.get("end") || ""), premium: String(values.get("premium") || ""), idv: String(values.get("idv") || "") });
  }
  return (
    <form action={formAction} onChange={event => trackFields(event.currentTarget)} encType="multipart/form-data" className="space-y-3" aria-busy={pending}>
      {children}
      {portal ? createPortal(<div className="space-y-3">{([["Vehicle",summary.vehicle],["Product",summary.type],["Insurer",summary.insurer],["Policy number",summary.number],["Start date",summary.start],["End date",summary.end],["IDV",summary.idv],["Premium",summary.premium]] as const).map(([label,value]) => <div key={label} className="flex items-start justify-between gap-2 border-b border-[#EEF2F8] pb-2"><span className="text-[#7185A0]">{label}</span><strong className="max-w-[58%] truncate text-right font-semibold text-[#183D6A]">{value && !value.startsWith("Select ") ? value : "—"}</strong></div>)}</div>,portal) : null}
      {state.error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          {state.error}
          {state.policyCreated ? (
            <a href={`/customer/policies?account=${encodeURIComponent(accountId)}`} className="ml-1 underline">
              View saved policy
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={{ pathname: "/customer/policies", query: { account: accountId } }} aria-disabled={pending} tabIndex={pending ? -1 : undefined} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-[#CBD8E8] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#17365F] transition hover:bg-[#F1F6FD] ${pending ? "pointer-events-none opacity-60" : ""}`}>Cancel</Link>
        <button
        type="submit"
        disabled={pending || state.policyCreated}
        aria-disabled={pending || state.policyCreated}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1755A7] px-5 py-2.5 text-[12px] font-extrabold text-white shadow-sm transition hover:bg-[#0B418A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155BAA] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>Saving...</> : state.policyCreated ? "Policy saved" : "Save policy"}
        </button>
      </div>
    </form>
  );
}
