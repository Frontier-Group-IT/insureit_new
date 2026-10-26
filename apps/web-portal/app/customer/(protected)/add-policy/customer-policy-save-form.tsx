"use client";

import { useActionState } from "react";
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
  return (
    <form action={formAction} encType="multipart/form-data" className="customer-workflow space-y-3" aria-busy={pending}>
      {children}
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
