"use client";

type Props = { partnerType:"posp"|"misp"; initialValues?:Record<string,string> };

export function LegacyOnboardingFields({ partnerType, initialValues = {} }: Props) {
  const registrationLabel = partnerType === "misp" ? "Existing MISP ID" : "Existing POSP ID";

  return (
    <section className="border-t border-amber-200 bg-amber-50/70 px-3 py-4 sm:px-5 sm:py-5" data-legacy-onboarding-fields="true">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.08em] text-amber-700">Existing intermediary migration</p>
          <h3 className="mt-1 text-[12px] font-semibold text-[#0F172A]">Previously issued permanent IDs</h3>
          <p className="mt-1 max-w-3xl text-[9.5px] leading-4 text-[#64748B]">These values bypass automatic Partner and POSP/MISP ID generation. After Partner documents are verified and the Partner is activated, use Import existing on the Partner review page to record historical training, exam, agreement and IIB completion.</p>
        </div>
        <span className="w-fit rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[8.5px] font-semibold text-amber-800">Legacy mode</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Existing Partner ID" name="legacy_partner_code" defaultValue={initialValues.legacy_partner_code} placeholder="PART-2024-00127" required />
        <Field label={registrationLabel} name="legacy_registration_code" defaultValue={initialValues.legacy_registration_code} placeholder={partnerType === "misp" ? "MISP-2023-00018" : "POSP-2024-00481"} required />
        <Field label="Original onboarding date" name="legacy_original_onboarding_date" type="date" defaultValue={initialValues.legacy_original_onboarding_date} required />
        <Field label="Active since" name="legacy_original_activation_date" type="date" defaultValue={initialValues.legacy_original_activation_date} required />
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">Migration verification remarks *</span>
        <textarea name="legacy_migration_remarks" required minLength={10} defaultValue={initialValues.legacy_migration_remarks} className="min-h-24 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-[12px] text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" placeholder="Mention where the existing IDs and historical records were verified." />
      </label>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 text-[10px] leading-5 text-amber-950">
        <input type="checkbox" name="legacy_confirmation" value="yes" required className="mt-1 h-4 w-4 shrink-0" />
        <span>I confirm that the Partner ID and {partnerType.toUpperCase()} ID were already issued and must be stored as permanent historical identifiers.</span>
      </label>
    </section>
  );
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label:string; name:string }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">{label}{props.required ? " *" : ""}</span>
      <input name={name} className="h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" {...props} />
    </label>
  );
}
