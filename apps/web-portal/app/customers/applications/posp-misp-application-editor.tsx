import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";
import { updateSubmittedPospMispApplication } from "./posp-misp-edit-actions";

export type PospMispEditProfile = {
  partner_type: "posp" | "misp";
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

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[11px] font-normal text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:bg-[#F8FAFC]";
const labelClass = "mb-1 block text-[10px] font-semibold text-[#344054]";
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
  return (
    <form action={editable ? updateSubmittedPospMispApplication : undefined}>
      <input type="hidden" name="application_id" value={applicationId} />
      <Section title={isMisp ? "MISP Business Details" : "POSP Details"}>
        <Select label="Associate Name" name="associate_profile_id" defaultValue={profile.associate_profile_id ?? ""} options={salesManagers} required disabled={!editable} />
        <Field label={isMisp ? "MISP ID" : "Onboarding ID"} name="external_onboarding_id" defaultValue={profile.external_onboarding_id ?? ""} disabled={!editable} />
        <IndianDateField label="Document Received Date" name="document_received_at" defaultValue={profile.document_received_at} disabled={!editable} />
        <Field label={isMisp ? "MISP Name" : "POS Name"} name={isMisp ? "misp_name" : "pos_name"} defaultValue={(isMisp ? profile.misp_name : profile.pos_name) ?? ""} required disabled={!editable} />
        <Field label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" defaultValue={profile.pan_number ?? ""} maxLength={10} disabled={!editable} />
        {isMisp ? <Select label="OEM Name" name="oem_name" defaultValue={profile.oem_name ?? ""} options={oems} required disabled={!editable} /> : null}
        <Field label="GST Number" name="gst_number" defaultValue={profile.gst_number ?? ""} maxLength={15} disabled={!editable} />
      </Section>

      <Section title={isMisp ? "Primary MISP Contact" : "Contact Details"}>
        <Field label="Mobile Number" name="applicant_phone" defaultValue={profile.applicant_phone ?? ""} required inputMode="tel" disabled={!editable} />
        <Field label="Email" name="applicant_email" defaultValue={profile.applicant_email ?? ""} type="email" disabled={!editable} />
        <IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} disabled={!editable} />
        <Field
          label="Aadhaar Number"
          name="aadhaar_number"
          defaultValue={profile.aadhaar_number ?? ""}
          placeholder={profile.aadhaar_last_four ? `Full number unavailable; stored ending ${profile.aadhaar_last_four}` : "12-digit Aadhaar"}
          inputMode="numeric"
          maxLength={12}
          disabled={!editable}
        />
        <Field label="Address" name="address" defaultValue={profile.address ?? ""} disabled={!editable} />
        <Field label="City" name="city" defaultValue={profile.city ?? ""} disabled={!editable} />
        <Field label="State" name="state" defaultValue={profile.state ?? ""} disabled={!editable} />
        <Field label="PIN Code" name="postal_code" defaultValue={profile.postal_code ?? ""} inputMode="numeric" disabled={!editable} />
      </Section>

      {isMisp ? (
        <Section title="DP Contact">
          <Field label="DP Name" name="dp_name" defaultValue={profile.dp_name ?? ""} required disabled={!editable} />
          <Field label="DP Mobile" name="dp_phone" defaultValue={profile.dp_phone ?? ""} required inputMode="tel" disabled={!editable} />
          <Field label="DP Email" name="dp_email" defaultValue={profile.dp_email ?? ""} type="email" disabled={!editable} />
          <Field label="DP PAN" name="dp_pan_number" defaultValue={profile.dp_pan_number ?? ""} maxLength={10} disabled={!editable} />
        </Section>
      ) : null}

      <Section title="Bank Details">
        <Select label="Bank Name" name="bank_id" defaultValue={profile.bank_id ?? ""} options={banks} required disabled={!editable} />
        <Field label="Account Number" name="bank_account_number" defaultValue={profile.bank_account_number ?? ""} disabled={!editable} />
        <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={profile.bank_ifsc_code ?? ""} disabled={!editable} />
      </Section>

      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
        <div>
          <h3 className="text-[13px] font-semibold text-[#0F172A]">Documents</h3>
          <p className="mt-1 text-[10px] text-[#64748B]">Choose a new file only when replacing the submitted document.</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-[#DCE5EF] bg-white p-3">
            <Select label="Marksheet Type" name="education_document_type" defaultValue={currentMarksheet?.document_type ?? ""} options={marksheetOptions.map(([value, label]) => ({ value, label }))} disabled={!editable} />
            <FileReplacement name="education_marksheet" current={currentMarksheet?.file_name} disabled={!editable} />
          </div>
          {documentFields.map(([documentType, label]) => {
            const current = documents.find((document) => document.document_type === documentType);
            return <div key={documentType} className="rounded-lg border border-[#DCE5EF] bg-white p-3"><span className={labelClass}>{label}</span><FileReplacement name={documentType} current={current?.file_name} disabled={!editable} /></div>;
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-[10.5px] text-[#64748B]">{editable ? "Saved changes update the submitted application and its verification documents." : "This submitted record is locked after approval or closure."}</p>
        {editable ? <FormSubmitButton label="Save Application Changes" pendingLabel="Saving changes" /> : null}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">{title}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={`submitted-${name}`}>{label}{props.required ? " *" : ""}</label><input id={`submitted-${name}`} name={name} className={inputClass} {...props} /></div>;
}

function Select({ label, name, options, required, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean }) {
  return <div><label className={labelClass} htmlFor={`submitted-${name}`}>{label}{required ? " *" : ""}</label><select id={`submitted-${name}`} name={name} required={required} className={inputClass} {...props}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

function FileReplacement({ name, current, disabled }: { name: string; current?: string; disabled: boolean }) {
  return (
    <div>
      <p className={`truncate text-[9.5px] ${current ? "text-emerald-700" : "text-[#64748B]"}`}>{current ?? "Not received"}</p>
      {!disabled ? <input name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 block w-full text-[9.5px] text-[#475569] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]" /> : null}
    </div>
  );
}
