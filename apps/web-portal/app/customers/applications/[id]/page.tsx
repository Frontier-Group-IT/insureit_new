import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { approveMobileIndividualApplication, requestMobileApplicationChanges } from "../actions";
import { approveMobileCorporateApplication, updateMobileCorporateApplicationDraft } from "../corporate-actions";
import { approveMobileGroupApplication } from "../group-actions";

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> };
type Application = { id: string; partner_type: string | null; status: string; applicant_phone: string | null; applicant_email: string | null; draft_data: Record<string, unknown> | null; created_at: string; updated_at: string; customer_id: string | null };
type Document = { id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string; verification_status: string };
type Contact = { contact_role:string; full_name:string; phone:string; email:string|null };

const labels: Record<string, string> = { pan_copy: "PAN card", company_pan_copy: "Company PAN copy", aadhaar_front: "Aadhaar front", aadhaar_back: "Aadhaar back", gst_copy: "GST certificate" };
const errors: Record<string, string> = {
  incomplete_application: "The application is missing required details.",
  invalid_corporate_details: "Enter a valid Company PAN/GSTIN and complete the required Corporate details.",
  contacts_incomplete:"Corporate creator, CEO, Admin Head and Dedicated SPOC must use four different login numbers.",
  applicant_contact_mismatch:"The Corporate creator login does not match the applicant phone.",
  documents_incomplete: "Required KYC documents are missing.",
  documents_unavailable: "Documents could not be loaded.",
  document_copy_failed: "A document could not be copied into the customer vault.",
  customer_already_exists: "A customer already uses this profile, phone, PAN, or Aadhaar identity.",
  customer_create_failed: "The customer record could not be created.",
  document_records_failed: "Permanent document records could not be created.",
  group_profile_failed: "The Group profile could not be created.",
  group_link_failed: "The Group affiliation could not be saved. Apply the latest Group hierarchy migration and try approval again.",
  membership_create_failed: "Customer login memberships could not be created.",
  contacts_create_failed: "Permanent customer contacts could not be created.",
  corporate_update_failed: "The Corporate application corrections could not be saved.",
  reason_required: "Enter a clear correction reason of at least 8 characters.",
  application_not_ready: "This application is not ready for approval."
};
const successes: Record<string, string> = { corporate_updated: "Corporate application details were saved.", changes_requested: "Correction request was sent to the customer." };
const contactRoles = [
  ["corporate_creator", "Corporate Creator"],
  ["ceo_head", "CEO / Head"],
  ["admin_head", "Admin Head"],
  ["dedicated_spoc", "Dedicated SPOC"],
] as const;

export default async function ApplicationReviewPage({ params, searchParams }: PageProps) {
  await requireMasterDataManager();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: application } = await supabase.from("customer_onboarding_applications").select("id, partner_type, status, applicant_phone, applicant_email, draft_data, created_at, updated_at, customer_id").eq("id", id).maybeSingle<Application>();
  if (!application) notFound();
  const { data: documents } = await supabase.from("customer_onboarding_documents").select("id, document_type, file_name, storage_bucket, storage_path, verification_status").eq("application_id", id).order("created_at").returns<Document[]>();
  const { data: contacts } = await supabase.from("customer_onboarding_contacts").select("contact_role,full_name,phone,email").eq("application_id",id).order("contact_role").returns<Contact[]>();
  const previews = await Promise.all((documents ?? []).map(async (document) => ({ ...document, url: (await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 900)).data?.signedUrl ?? null })));
  const draft = application.draft_data ?? {};
  const supportedPartner = ["individual_proprietor","group","corporate"].includes(application.partner_type??"");
  const canReview = supportedPartner && ["submitted", "under_review"].includes(application.status) && !application.customer_id;
  const isCorporate = application.partner_type === "corporate";
  const pageError = query.error === "application_not_ready" && !canReview ? null : query.error;
  const contactByRole = new Map((contacts ?? []).map((contact) => [contact.contact_role, contact]));
  const approveAction = application.partner_type === "group" ? approveMobileGroupApplication : isCorporate ? approveMobileCorporateApplication : approveMobileIndividualApplication;
  const fields = application.partner_type === "group" ? [["Group name", draft.group_name], ["Owner / promoter", draft.owner_name], ["Mobile", application.applicant_phone], ["Email", draft.email ?? application.applicant_email]] : isCorporate ? [["Company name",draft.company_name],["Company PAN",draft.company_pan],["GSTIN",draft.gst_number],["Address",[draft.address_street,draft.address_locality].filter(Boolean).join(", ")],["Location",[draft.city,draft.state,draft.postal_code].filter(Boolean).join(", ")],["Fleet size",labelValue(draft.fleet_size_band)]] : [["Full name", draft.contact_name], ["Mobile", application.applicant_phone], ["Email", draft.email ?? application.applicant_email], ["PAN", draft.pan_number], ["Aadhaar", draft.aadhaar_last_four ? `Ends in ${draft.aadhaar_last_four}` : null], ["Address", [draft.address_street, draft.address_locality].filter(Boolean).join(", ")], ["Location", [draft.city, draft.state, draft.postal_code].filter(Boolean).join(", ")], ["Fleet size", labelValue(draft.fleet_size_band)], ["GST registered", draft.is_gst_registered === true ? "Yes" : "No"], ["Legal trade name", draft.legal_trade_name], ["GSTIN", draft.gst_number]];

  return (
    <AppShell title="Review KYC Application">
      <div className="mx-auto max-w-6xl pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/customers/applications" className="text-[11px] font-semibold text-[#4F46E5]">Back to applications</Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-600">{partnerLabel(application.partner_type)}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700">{application.status.replaceAll("_", " ")}</span>
          </div>
        </div>
        {pageError ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">{errors[pageError] ?? "The action could not be completed."}</div> : null}
        {query.success ? <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">{successes[query.success] ?? "Saved successfully."}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-xl border border-[#DCE5EF] bg-white shadow-sm">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Review workspace</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">{isCorporate ? "Corporate application details" : "Applicant details"}</h2>
            </div>
            {isCorporate ? (
              <form action={canReview ? updateMobileCorporateApplicationDraft : undefined} className="p-5">
                <input type="hidden" name="application_id" value={id}/>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field name="company_name" label="Company name" defaultValue={textValue(draft.company_name)} required disabled={!canReview}/>
                  <Field name="company_pan" label="Company PAN" defaultValue={textValue(draft.company_pan)} required disabled={!canReview}/>
                  <Field name="gst_number" label="GSTIN" defaultValue={textValue(draft.gst_number)} disabled={!canReview}/>
                  <SelectField name="fleet_size_band" label="Fleet size" defaultValue={textValue(draft.fleet_size_band)} required disabled={!canReview}/>
                </div>
                <div className="mt-5 border-t border-[#E2E8F0] pt-5">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Registered address</h3>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <Field name="address_street" label="Street" defaultValue={textValue(draft.address_street)} required disabled={!canReview}/>
                    <Field name="address_locality" label="Locality" defaultValue={textValue(draft.address_locality)} disabled={!canReview}/>
                    <Field name="city" label="City" defaultValue={textValue(draft.city)} required disabled={!canReview}/>
                    <Field name="state" label="State" defaultValue={textValue(draft.state)} required disabled={!canReview}/>
                    <Field name="postal_code" label="PIN code" defaultValue={textValue(draft.postal_code)} required disabled={!canReview}/>
                    <Field name="india_location_id" label="Location ID" defaultValue={textValue(draft.india_location_id)} required disabled={!canReview}/>
                  </div>
                </div>
                <div className="mt-5 border-t border-[#E2E8F0] pt-5">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Corporate login contacts</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {contactRoles.map(([role, label]) => {
                      const contact = contactByRole.get(role);
                      const fallbackPhone = role === "corporate_creator" ? application.applicant_phone : null;
                      const fallbackEmail = role === "corporate_creator" ? application.applicant_email : null;
                      return (
                        <div key={role} className="rounded-xl border border-[#E2E8F0] bg-[#FBFDFF] p-4">
                          <p className="text-xs font-semibold text-[#0F172A]">{label}</p>
                          <div className="mt-3 space-y-3">
                            <Field name={`${role}_name`} label="Full name" defaultValue={contact?.full_name ?? ""} required disabled={!canReview}/>
                            <Field name={`${role}_phone`} label="Mobile number" defaultValue={contact?.phone ?? fallbackPhone ?? ""} required disabled={!canReview}/>
                            <Field name={`${role}_email`} label="Email" defaultValue={contact?.email ?? fallbackEmail ?? ""} disabled={!canReview}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {canReview ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-4 py-3">
                    <p className="text-[11px] text-[#64748B]">Save corrections before approving if the submitted data does not match the uploaded documents.</p>
                    <button className="rounded-md bg-[#0F2A55] px-4 py-2 text-[11px] font-semibold text-white">Save corrections</button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-medium text-emerald-800">
                    This application is already {application.status.replaceAll("_", " ")}. The submitted KYC record is locked here; edit the activated customer profile for post-approval changes.
                  </div>
                )}
              </form>
            ) : (
              <div className="grid gap-px bg-[#E8EEF5] sm:grid-cols-2">
                {fields.map(([label, fieldValue]) => <div key={String(label)} className="bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#64748B]">{String(label)}</p><p className="mt-1 text-[11.5px] font-medium text-[#0F172A]">{display(fieldValue)}</p></div>)}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#0F172A]">Documents</h2>
              <div className="mt-3 space-y-2">
                {previews.map((document)=><div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] px-3 py-2"><div className="min-w-0"><p className="text-[11px] font-semibold">{labels[document.document_type]??document.document_type}</p><p className="truncate text-[9.5px] text-[#64748B]">{document.file_name}</p></div>{document.url?<a href={document.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1 text-[9.5px] font-semibold">Open</a>:null}</div>)}
                {!previews.length?<p className="text-[11px] text-[#64748B]">No documents uploaded.</p>:null}
              </div>
            </section>
            {canReview ? (
              <section className="rounded-xl border border-[#DCE5EF] bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-[#0F172A]">Decision</h2>
                <form action={approveAction} className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <input type="hidden" name="application_id" value={id}/>
                  <p className="text-[11px] font-semibold text-emerald-900">Approve and activate</p>
                  <p className="mt-1 text-[10px] text-emerald-800">Creates the customer, memberships and permanent document records.</p>
                  <button className="mt-3 w-full rounded-md bg-emerald-700 px-4 py-2 text-[11px] font-semibold text-white">Approve KYC</button>
                </form>
                <form action={requestMobileApplicationChanges} className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3">
                  <input type="hidden" name="application_id" value={id}/>
                  <label className="text-[11px] font-semibold text-red-900" htmlFor="reason">Request corrections</label>
                  <textarea id="reason" name="reason" required minLength={8} className="mt-2 min-h-20 w-full rounded-md border border-red-100 bg-white p-2 text-[11px]"/>
                  <button className="mt-2 w-full rounded-md border border-red-200 bg-white px-4 py-2 text-[11px] font-semibold text-red-700">Send back</button>
                </form>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ name, label, defaultValue, required, disabled }: { name:string; label:string; defaultValue:string; required?:boolean; disabled?:boolean }) {
  return <label className="block text-[11px] font-semibold text-[#0F172A]">{label}{required ? " *" : ""}<input name={name} defaultValue={defaultValue} required={required} disabled={disabled} className="mt-1 h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] font-medium text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-blue-100 disabled:bg-[#F8FAFC] disabled:text-[#475569]"/></label>;
}
function SelectField({ name, label, defaultValue, required, disabled }: { name:string; label:string; defaultValue:string; required?:boolean; disabled?:boolean }) {
  return <label className="block text-[11px] font-semibold text-[#0F172A]">{label}{required ? " *" : ""}<select name={name} defaultValue={defaultValue} required={required} disabled={disabled} className="mt-1 h-10 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] font-medium text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-blue-100 disabled:bg-[#F8FAFC] disabled:text-[#475569]"><option value="">Select fleet size</option><option value="less_than_5">Less than 5</option><option value="5_to_20">5 to 20</option><option value="20_to_50">20 to 50</option><option value="more_than_50">More than 50</option></select></label>;
}
function display(value: unknown) { if (typeof value === "string" && value.trim()) return value; if (typeof value === "number") return String(value); return "-"; }
function textValue(value: unknown) { return typeof value === "string" ? value : ""; }
function labelValue(value: unknown) { const values: Record<string, string> = { less_than_5: "Less than 5", "5_to_20": "5 to 20", "20_to_50": "20 to 50", more_than_50: "More than 50" }; return typeof value === "string" ? values[value] ?? value : null; }
function partnerLabel(value: string | null) { const values: Record<string, string> = { individual_proprietor: "Individual / Proprietor", group: "Group", corporate: "Corporate", dealership: "Dealership" }; return value ? values[value] ?? value : "Unknown"; }
