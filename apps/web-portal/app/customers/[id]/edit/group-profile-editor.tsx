import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";

type GroupCustomer = {
  company_name: string | null;
  contact_name: string;
  phone: string;
  email: string | null;
  onboarding_status: string;
};
type GroupProfile = { group_name: string; owner_name: string; company_name: string | null };
type Member = { id: string; customer_code: string; partner_type: string; company_name: string | null; contact_name: string; city: string | null };
type Candidate = Member;
type Props = {
  customer: GroupCustomer;
  profile: GroupProfile | null;
  members: Member[];
  candidates: Candidate[];
  updateAction: (formData: FormData) => Promise<void>;
  addMemberAction: (formData: FormData) => Promise<void>;
  removeMemberAction: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  successMessage: string | null;
};

const input = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A]";
const label = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function GroupProfileEditor({ customer, profile, members, candidates, updateAction, addMemberAction, removeMemberAction, errorMessage, successMessage }: Props) {
  const groupName = profile?.group_name || customer.company_name || "";
  const ownerName = profile?.owner_name || customer.contact_name;
  return <div className="mx-auto max-w-[1240px] space-y-3 pb-16">
    {errorMessage ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{errorText(errorMessage)}</div> : null}
    {successMessage ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">{successText(successMessage)}</div> : null}

    <form action={updateAction} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <section className="border-b border-[#E2E8F0] px-5 py-4">
        <h3 className="mb-3 text-[13px] font-semibold">Group details</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field labelText="Group name" name="group_name" required defaultValue={groupName} />
          <Field labelText="Owner name" name="owner_name" required defaultValue={ownerName} />
          <Field labelText="Mobile" name="phone" required maxLength={10} defaultValue={customer.phone.replace(/^\+91/, "")} />
          <Field labelText="Email" name="email" type="email" defaultValue={customer.email ?? ""} />
          <div><label className={label} htmlFor="onboarding_status">Status</label><select id="onboarding_status" name="onboarding_status" defaultValue={customer.onboarding_status} className={input}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
      </section>
      <div className="flex justify-end gap-2 px-5 py-3"><Link href="/customers" className="rounded-md border px-4 py-2 text-[11px] font-semibold">Cancel</Link><FormSubmitButton label="Save Group Profile" /></div>
    </form>

    <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div><h3 className="text-[13px] font-semibold">Group members</h3><p className="mt-1 text-[10.5px] text-[#64748B]">All active Group logins can view every active customer listed below.</p></div>
        <form action={addMemberAction} className="flex min-w-0 gap-2 md:w-[520px]">
          <select name="child_customer_id" required defaultValue="" className={input}><option value="">Select an active customer to add</option>{candidates.map((item) => <option key={item.id} value={item.id}>{displayName(item)} · {partnerLabel(item.partner_type)} · {item.customer_code}</option>)}</select>
          <FormSubmitButton label="Add member" />
        </form>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[11px]">
          <thead className="bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Code</th><th className="px-4 py-2">Partner type</th><th className="px-4 py-2">City</th><th className="px-4 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-[#EEF2F6]">{members.length ? members.map((member) => <tr key={member.id}><td className="px-4 py-3 font-semibold text-[#17203A]">{displayName(member)}</td><td className="px-4 py-3 text-[#64748B]">{member.customer_code}</td><td className="px-4 py-3"><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[9px] font-semibold text-[#4338CA]">{partnerLabel(member.partner_type)}</span></td><td className="px-4 py-3 text-[#64748B]">{member.city ?? "—"}</td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-2"><Link href={`/customers/${member.id}/edit`} className="rounded-md border px-3 py-1.5 text-[10px] font-semibold text-[#334155]">Open</Link><form action={removeMemberAction}><input type="hidden" name="child_customer_id" value={member.id} /><button type="submit" className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-semibold text-red-700">Remove</button></form></div></td></tr>) : <tr><td colSpan={5} className="px-4 py-10 text-center text-[#64748B]">No child customers are linked to this Group yet.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function Field({ labelText, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { labelText: string }) { return <div><label className={label} htmlFor={String(props.name)}>{labelText}{props.required ? " *" : ""}</label><input id={String(props.name)} className={input} {...props} /></div>; }
function displayName(item: Member) { return item.company_name?.trim() || item.contact_name; }
function partnerLabel(value: string) { return value === "individual_proprietor" ? "Individual / Proprietor" : value.charAt(0).toUpperCase() + value.slice(1); }
function errorText(value: string) { const map: Record<string,string> = { unauthorized: "You are not authorized.", invalid_group_details: "Enter valid Group details.", invalid_group: "The Group customer could not be found.", group_not_active: "Activate the Group before adding members.", select_child_customer: "Select a customer to add.", invalid_child_customer: "Only active Corporate, Individual/Proprietor or Dealership customers can be added.", member_link_failed: "The customer could not be linked to this Group.", member_remove_failed: "The customer could not be removed from this Group.", group_update_failed: "The Group customer could not be updated.", group_profile_update_failed: "The Group profile could not be updated." }; return map[value] ?? "The requested Group change could not be completed."; }
function successText(value: string) { const map: Record<string,string> = { group_updated: "Group profile updated.", member_added: "Customer added to the Group.", member_removed: "Customer removed from the Group." }; return map[value] ?? "Group updated."; }
