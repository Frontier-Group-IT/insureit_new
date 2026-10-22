"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";

export type SpotSaveState = { error: string | null };
const initialState: SpotSaveState = { error: null };

export function SpotIntimationSaveForm({ action, children }: {
  action: (state: SpotSaveState, form: FormData) => Promise<SpotSaveState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} aria-busy={pending} className="space-y-6 rounded-3xl border border-[#DBE4F0] bg-white p-5">
    {children}
    {state.error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{state.error}</p> : null}
    <button type="submit" disabled={pending} aria-disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B3884] px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70">
      {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>Saving...</> : "Save Spot Intimation →"}
    </button>
  </form>;
}
