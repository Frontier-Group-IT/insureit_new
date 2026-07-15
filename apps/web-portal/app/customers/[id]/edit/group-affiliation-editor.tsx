import { FormSubmitButton } from "@/components/form-submit-button";

type GroupOption = { id: string; customer_code: string; company_name: string | null; contact_name: string };

type Props = {
  groups: GroupOption[];
  currentGroupId: string | null;
  action: (formData: FormData) => Promise<void>;
  successMessage?: string | null;
  errorMessage?: string | null;
};

export function GroupAffiliationEditor({ groups, currentGroupId, action, successMessage, errorMessage }: Props) {
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <h3 className="text-[13px] font-semibold text-[#0F172A]">Group affiliation</h3>
        <p className="mt-1 text-[10.5px] text-[#64748B]">Link this customer below an active Group. Leaving it blank removes the current Group link without deleting any customer data.</p>
      </div>
      {successMessage === "group_affiliation_updated" ? <div className="mx-5 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10.5px] font-semibold text-emerald-700">Group affiliation updated.</div> : null}
      {errorMessage?.startsWith("group_affiliation") || errorMessage === "invalid_parent_group" || errorMessage === "invalid_group_child" ? <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] font-semibold text-red-700">The Group affiliation could not be updated. Please verify the selected Group and try again.</div> : null}
      <form action={action} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor="parent_group_id">Parent Group</label>
          <select id="parent_group_id" name="parent_group_id" defaultValue={currentGroupId ?? ""} className="h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]">
            <option value="">No parent Group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.company_name?.trim() || group.contact_name} · {group.customer_code}</option>)}
          </select>
        </div>
        <FormSubmitButton label="Save Group affiliation" />
      </form>
    </section>
  );
}
