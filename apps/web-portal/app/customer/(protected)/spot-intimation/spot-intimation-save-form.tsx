"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export type SpotSaveState = { error: string | null };
const initialState: SpotSaveState = { error: null };

export function SpotIntimationSaveForm({ action, children }: {
  action: (state: SpotSaveState, form: FormData) => Promise<SpotSaveState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} aria-busy={pending} className="space-y-4 rounded-2xl border border-[#DBE4F0] bg-white p-4 shadow-[0_6px_24px_rgba(20,58,100,.04)] sm:p-5">
    {children}
    {state.error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{state.error}</p> : null}
    <button type="submit" disabled={pending} aria-disabled={pending} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1253A7] px-5 py-3 text-[13px] font-bold text-white transition hover:bg-[#0B3884] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1253A7] disabled:cursor-not-allowed disabled:opacity-70">
      {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>Saving...</> : <>Save &amp; Continue <ArrowRight className="h-4 w-4" aria-hidden="true"/></>}
    </button>
  </form>;
}
