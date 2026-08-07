import Link from "next/link";

type InsurerFormValues = {
  name?: string | null;
  segment?: string | null;
  sibpl_code?: string | null;
  portal_url?: string | null;
  portal_status?: string | null;
  is_active?: boolean | null;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  values?: InsurerFormValues;
  submitLabel: string;
  cancelHref: string;
  error?: string | null;
};

const inputClass = "h-11 w-full rounded-xl border border-[#D6DFEB] bg-white px-3.5 text-[12px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
const labelClass = "mb-1.5 block text-[9px] font-bold uppercase tracking-[0.07em] text-[#52647D]";

export function InsuranceCompanyMasterForm({ action, values, submitLabel, cancelHref, error }: Props) {
  return (
    <form action={action} className="space-y-5">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="name">Full registered company name <span className="text-red-500">*</span></label>
          <input id="name" name="name" className={inputClass} defaultValue={values?.name ?? ""} placeholder="Example: Star Health and Allied Insurance Company Limited" required maxLength={180} autoComplete="off" />
          <p className="mt-1.5 text-[9px] leading-4 text-[#7B8799]">Use the legal/current registered insurer name. Short labels and former names belong in aliases, not this field.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="segment">Insurance segment <span className="text-red-500">*</span></label>
          <select id="segment" name="segment" className={inputClass} defaultValue={values?.segment ?? ""} required>
            <option value="">Select segment</option>
            <option value="general">General Insurance</option>
            <option value="health">Health Insurance</option>
            <option value="life">Life Insurance</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="sibpl_code">SIBPL code</label>
          <input id="sibpl_code" name="sibpl_code" className={inputClass} defaultValue={values?.sibpl_code ?? ""} placeholder="Code or Pending" maxLength={80} autoComplete="off" />
          <p className="mt-1.5 text-[9px] text-[#7B8799]">Stored as text because broker codes can contain letters, slashes, spaces, or Pending.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="portal_status">Portal status <span className="text-red-500">*</span></label>
          <select id="portal_status" name="portal_status" className={inputClass} defaultValue={values?.portal_status ?? "not_provided"} required>
            <option value="configured">Configured</option>
            <option value="pending">Pending</option>
            <option value="not_provided">Not provided</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="portal_url">Insurer portal URL</label>
          <input id="portal_url" name="portal_url" className={inputClass} defaultValue={values?.portal_url ?? ""} placeholder="https://..." inputMode="url" autoComplete="url" />
          <p className="mt-1.5 text-[9px] text-[#7B8799]">Required only when portal status is Configured. Do not store portal usernames or passwords here.</p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCE5F0] bg-[#F8FAFD] px-4 py-3">
        <input name="is_active" type="checkbox" defaultChecked={values?.is_active ?? true} className="mt-0.5 h-4 w-4 accent-[#17365D]" />
        <span>
          <span className="block text-[11px] font-bold text-[#17203A]">Active for new business</span>
          <span className="mt-0.5 block text-[9px] leading-4 text-[#667085]">Inactive insurers remain visible on historical policies but are removed from new-policy selection.</span>
        </span>
      </label>

      <div className="flex flex-wrap justify-end gap-2 border-t border-[#E6EBF2] pt-4">
        <Link href={cancelHref} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</Link>
        <button type="submit" className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white shadow-sm hover:bg-[#102A4C]">{submitLabel}</button>
      </div>
    </form>
  );
}
