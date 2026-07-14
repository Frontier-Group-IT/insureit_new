"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import type { GroupOnboardingState } from "./group-actions";

type Props = { action: (state: GroupOnboardingState, formData: FormData) => Promise<GroupOnboardingState> };

const inputClass = "h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function GroupOnboardingForm({ action }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setShowError(Boolean(state.error));
    if (!state.field) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.elements.namedItem(state.field ?? "");
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [state.error, state.field]);

  return (
    <>
      {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
      <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">Group</span>
          <Link href="/customers?choose_partner=1" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Change partner type</Link>
        </div>

        <form ref={formRef} action={formAction} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <section className="px-5 py-5">
            <div className="mb-4">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Group Details</h3>
              <p className="mt-1 text-[10.5px] text-[#64748B]">Create the umbrella customer first. Corporate, dealership and individual customers can be linked below this group afterward.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Group Name" name="group_name" required placeholder="Group or umbrella name" />
              <Field label="Owner Name" name="owner_name" required placeholder="Owner or promoter" />
              <Field label="Contact Number" name="phone" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" />
              <Field label="Email ID" name="email" type="email" placeholder="Optional email" />
            </div>
          </section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur">
            <Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link>
            <FormSubmitButton label="Create Group" />
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>;
}
