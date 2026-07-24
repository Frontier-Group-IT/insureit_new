import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";
import { updateSubmittedPospMispApplication } from "./posp-misp-edit-actions";

export type PospMispEditProfile = {
  partner_type: "posp" | "misp";
  associate_employee_id: string | null;
  associate_profile_id: string | null;
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  date_of_birth: string | null;
  aadhaar_last_four: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_id: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  oem_name: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
};

type Props = {
  applicationId: string;
  profile: PospMispEditProfile;
  editable: boolean;
  salesManagers: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
  oems: Array<{ value: string; label: string }>;
  documents: Array<{ document_type: string; file_name: string }>;
};

const inputClass = "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE] disabled:bg-[#F8FAFC] disabled:text-[#475569]";
const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const marksheetOptions = [
  ["education_10th_marksheet", "10th Marksheet"],
  ["education_12th_marksheet", "12th Marksheet"],
  ["education_graduation_marksheet", "Graduation Marksheet"],
  ["education_post_graduation_marksheet", "Post Graduation Marksheet"]
] as const;
const documentFields = [
  ["aadhaar_front", "Aadhaar front"],
  ["aadhaar_back", "Aadhaar back"],
  ["pan_copy", "PAN copy"],
  ["cancelled_cheque", "Cancelled cheque"],
  ["photograph", "Photograph"],
  ["gst_copy", "GST certificate"],
  ["agreement_copy", "Agreement copy"]
] as const;

export function PospMispApplicationEditor({ applicationId, profile, editable, salesManagers, banks, oems, documents }: Props) {
  const isMisp = profile.partner_type === "misp";
  const currentMarksheet = documents.find((document) => marksheetOptions.some(([value]) => value === document.document_type));
  const receivedDocuments = documents.length;
  const displayName = (isMisp ? profile.misp_name : profile.pos_name) || "Application pending name verification";

  return (
    <form action={editable ? updateSubmittedPospMispApplication : undefined} className="bg-[#F4F7FB]">
      <input type="hidden" name="application_id" value={applicationId} />
      <div className="border-b border-[#DCE5EF] bg-white px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Official onboarding file</p>
            <h2 className="mt-1 text-lg font-semibold text-[#071D49]">{displayName}</h2>
            <p className="mt-1 text-[10.5px] text-[#64748B]">Application ref. {applicationId.slice(0, 8).toUpperCase()} · {profile.partner_type.toUpperCase()} verification record</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <FileMetric label="Documents" value={String(receivedDocuments)} />
            <FileMetric label="Mode" value={editable ? "Review" : "Read only"} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <FileSection number="01" title={isMisp ? "MISP business particulars" : "POSP particulars"} subtitle="Core registration identity and assigned sales associate.">
          <Select label="Associate Name" name="associate_employee_id" defaultValue={profile.associate_employee_id ?? profile.associate_profile_id ?? ""} options={salesManagers} required disabled={!editable} />
          <Field label={isMisp ? "MISP ID" : "Onboarding ID"} name="external_onboarding_id" defaultValue={profile.external_onboarding_id ?? ""} disabled={!editable} />
          <IndianDateField label="Document Received Date" name="document_received_at" defaultValue={profile.document_received_at} disabled={!editable} />
          <Field label={isMisp ? "MISP Name" : "POS Name"} name={isMisp ? "misp_name" : "pos_name"} defaultValue={(isMisp ? profile.misp_name : profile.pos_name) ?? ""} required disabled={!editable} />
          <Field label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" defaultValue={profile.pan_number ?? ""} maxLength={10} disabled={!editable} />
          {isMisp ? <Select label="OEM Name" name="oem_name" defaultValue={profile.oem_name ?? ""} options={oems} required disabled={!editable} /> : null}
          <Field label="GST Number" name="gst_number" defaultValue={profile.gst_number ?? ""} maxLength={15} disabled={!editable} />
        </FileSection>

        <FileSection number="02" title={isMisp ? "Primary MISP contact" : "Applicant identity and contact"} subtitle="Identity, communication and registered address details.">
          <Field label="Mobile Number" name="applicant_phone" defaultValue={profile.applicant_phone ?? ""} required inputMode="tel" disabled={!editable} />
          <Field label="Email" name="applicant_email" defaultValue={profile.applicant_email ?? ""} type="email" disabled={!editable} />
          <IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} disabled={!editable} />
          <Field label="Aadhaar Number" name="aadhaar_number" defaultValue={profile.aadhaar_number ?? ""} placeholder={profile.aadhaar_last_four ? `Stored ending ${profile.aadhaar_last_four}` : "12-digit Aadhaar"} inputMode="numeric" maxLength={12} disabled={!editable} />
          <div className="md:col-span-2"><Field label="Address" name="address" defaultValue={profile.address ?? ""} disabled={!editable} /></div>
          <Field label="City" name="city" defaultValue={profile.city ?? ""} disabled={!editable} />
          <Field label="State" name="state" defaultValue={profile.state ?? ""} disabled={!editable} />
          <Field label="PIN Code" name="postal_code" defaultValue={profile.postal_code ?? ""} inputMode="numeric" disabled={!editable} />
        </FileSection>

        {isMisp ? <FileSection number="03" title="Designated person contact" subtitle="Operational DP identity used for MISP login and coordination.">
          <Field label="DP Name" name="dp_name" defaultValue={profile.dp_name ?? ""} required disabled={!editable} />
          <Field label="DP Mobile" name="dp_phone" defaultValue={profile.dp_phone ?? ""} required inputMode="tel" disabled={!editable} />
          <Field label="DP Email" name="dp_email" defaultValue={profile.dp_email ?? ""} type="email" disabled={!editable} />
          <Field label="DP PAN" name="dp_pan_number" defaultValue={profile.dp_pan_number ?? ""} maxLength={10} disabled={!editable} />
        </FileSection> : null}

        <FileSection number={isMisp ? "04" : "03"} title="Bank particulars" subtitle="Account verification information for operational settlement.">
          <Select label="Bank Name" name="bank_id" defaultValue={profile.bank_id ?? ""} options={banks} required disabled={!editable} />
          <Field label="Account Number" name="bank_account_number" defaultValue={profile.bank_account_number ?? ""} disabled={!editable} />
          <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={profile.bank_ifsc_code ?? ""} disabled={!editable} />
        </FileSection>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <FileSectionHeader number={isMisp ? "05" : "04"} title="Verification documents" subtitle="Submitted files remain visible; choose a replacement only when correction is required." />
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            <DocumentCard label="Marksheet" current={currentMarksheet?.file_name}>
              <Select label="Marksheet Type" name="education_document_type" defaultValue={currentMarksheet?.document_type ?? ""} options={marksheetOptions.map(([value, label]) => ({ value, label }))} disabled={!editable} />
              <FileReplacement name="education_marksheet" current={currentMarksheet?.file_name} disabled={!editable} />
            </DocumentCard>
            {documentFields.map(([documentType, label]) => {
              const current = documents.find((document) => document.document_type === documentType);
              return <DocumentCard key={documentType} label={label} current={current?.file_name}><FileReplacement name={documentType} current={current?.file_name} disabled={!editable} /></DocumentCard>;
            })}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-4 backdrop-blur">
        <p className="text-[10.5px] text-[#64748B]">{editable ? "Review the official file and save verified corrections before progressing the workflow." : "This official onboarding file is locked after approval or closure."}</p>
        {editable ? <FormSubmitButton label="Save verified corrections" pendingLabel="Saving verified corrections" /> : null}
      </div>
    </form>
  );
}

function FileSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><FileSectionHeader number={number} title={title} subtitle={subtitle} /><div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}
function FileSectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div className="flex items-start gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p></div></div>;
}
function FileMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-24 rounded-lg border border-[#DCE5EF] bg-[#F8FAFC] px-3 py-2"><p className="text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#64748B]">{label}</p><p className="mt-0.5 text-[11px] font-semibold text-[#071D49]">{value}</p></div>; }
function DocumentCard({ label, current, children }: { label: string; current?: string; children: React.ReactNode }) { return <div className={`rounded-xl border p-3 ${current ? "border-emerald-200 bg-emerald-50/35" : "border-amber-200 bg-amber-50/30"}`}><div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10.5px] font-semibold text-[#0F172A]">{label}</span><span className={`rounded-full px-2 py-0.5 text-[8.5px] font-semibold ${current ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{current ? "Received" : "Pending"}</span></div>{children}</div>; }
function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass} htmlFor={`submitted-${name}`}>{label}{props.required ? " *" : ""}</label><input id={`submitted-${name}`} name={name} className={inputClass} {...props} /></div>; }
function Select({ label, name, options, required, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean }) { return <div><label className={labelClass} htmlFor={`submitted-${name}`}>{label}{required ? " *" : ""}</label><select id={`submitted-${name}`} name={name} required={required} className={inputClass} {...props}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function FileReplacement({ name, current, disabled }: { name: string; current?: string; disabled: boolean }) { return <div><p className={`truncate text-[9.5px] ${current ? "text-emerald-700" : "text-[#64748B]"}`}>{current ?? "Not received"}</p>{!disabled ? <input name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 block w-full text-[9.5px] text-[#475569] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]" /> : null}</div>; }
