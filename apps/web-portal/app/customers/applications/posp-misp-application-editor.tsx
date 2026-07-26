import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";
import { updateSubmittedPospMispApplication } from "./posp-misp-edit-actions";

export type PospMispEditProfile={partner_type:"posp"|"misp";associate_employee_id:string|null;associate_profile_id:string|null;external_onboarding_id:string|null;document_received_at:string|null;pos_name:string|null;misp_name:string|null;applicant_phone:string|null;applicant_email:string|null;date_of_birth:string|null;aadhaar_last_four:string|null;aadhaar_number:string|null;pan_number:string|null;gst_number:string|null;address:string|null;city:string|null;state:string|null;postal_code:string|null;bank_id:string|null;bank_account_number:string|null;bank_ifsc_code:string|null;oem_name:string|null;dp_name:string|null;dp_phone:string|null;dp_email:string|null;dp_pan_number:string|null};
type Props={applicationId:string;profile:PospMispEditProfile;editable:boolean;salesManagers:Array<{value:string;label:string}>;banks:Array<{value:string;label:string}>;oems:Array<{value:string;label:string}>;documents:Array<{document_type:string;file_name:string}>};

const inputClass="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569]";
const labelClass="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const marksheetOptions=[["education_10th_marksheet","10th Marksheet"],["education_12th_marksheet","12th Marksheet"],["education_graduation_marksheet","Graduation Marksheet"],["education_post_graduation_marksheet","Post Graduation Marksheet"]] as const;
const documentFields=[["aadhaar_front","Aadhaar front"],["aadhaar_back","Aadhaar back"],["pan_copy","PAN copy"],["cancelled_cheque","Cancelled cheque"],["photograph","Photograph"],["gst_copy","GST certificate"],["agreement_copy","Agreement copy"]] as const;

export function PospMispApplicationEditor({applicationId,profile,editable,salesManagers,banks,oems,documents}:Props){
  const isMisp=profile.partner_type==="misp";
  const currentMarksheet=documents.find(document=>marksheetOptions.some(([value])=>value===document.document_type));
  return <form action={editable?updateSubmittedPospMispApplication:undefined} className="bg-[#F4F7FB]">
    <input type="hidden" name="application_id" value={applicationId}/>
    <div className="space-y-4 p-4 sm:p-5">
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <Header number="1" title="Primary information" subtitle="Save the applicant details. PAN checking is automatic and the IIB result cannot be edited manually."/>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Associate" name="associate_employee_id" defaultValue={profile.associate_employee_id??profile.associate_profile_id??""} options={salesManagers} required disabled={!editable}/>
          <Field label="Onboarding ID" name="external_onboarding_id" defaultValue={profile.external_onboarding_id??""} placeholder="Enter onboarding ID" disabled={!editable}/>
          <Field label={isMisp?"MISP Name":"POS Name"} name={isMisp?"misp_name":"pos_name"} defaultValue={(isMisp?profile.misp_name:profile.pos_name)??""} required disabled={!editable}/>
          <Field label="PAN Number" name="pan_number" defaultValue={profile.pan_number??""} maxLength={10} disabled={!editable}/>
          <IndianDateField label="Document Received Date" name="document_received_at" defaultValue={profile.document_received_at} disabled={!editable}/>
          {isMisp?<Select label="OEM" name="oem_name" defaultValue={profile.oem_name??""} options={oems} required disabled={!editable}/>:null}
          <Field label="GST Number" name="gst_number" defaultValue={profile.gst_number??""} maxLength={15} disabled={!editable}/>
          <Field label="Mobile Number" name="applicant_phone" defaultValue={profile.applicant_phone??""} required inputMode="tel" disabled={!editable}/>
          <Field label="Email" name="applicant_email" defaultValue={profile.applicant_email??""} type="email" disabled={!editable}/>
          <IndianDateField label="Date of Birth" name="date_of_birth" defaultValue={profile.date_of_birth} disabled={!editable}/>
          <Field label="Aadhaar Number" name="aadhaar_number" defaultValue={profile.aadhaar_number??""} placeholder={profile.aadhaar_last_four?`Stored ending ${profile.aadhaar_last_four}`:"12-digit Aadhaar"} maxLength={12} disabled={!editable}/>
          <div className="md:col-span-2"><Field label="Address" name="address" defaultValue={profile.address??""} disabled={!editable}/></div>
          <Field label="City" name="city" defaultValue={profile.city??""} disabled={!editable}/>
          <Field label="State" name="state" defaultValue={profile.state??""} disabled={!editable}/>
          <Field label="PIN Code" name="postal_code" defaultValue={profile.postal_code??""} inputMode="numeric" disabled={!editable}/>
          {isMisp?<><Field label="DP Name" name="dp_name" defaultValue={profile.dp_name??""} required disabled={!editable}/><Field label="DP Mobile" name="dp_phone" defaultValue={profile.dp_phone??""} required disabled={!editable}/><Field label="DP Email" name="dp_email" defaultValue={profile.dp_email??""} type="email" disabled={!editable}/><Field label="DP PAN" name="dp_pan_number" defaultValue={profile.dp_pan_number??""} maxLength={10} disabled={!editable}/></>:null}
          <Select label="Bank Name" name="bank_id" defaultValue={profile.bank_id??""} options={banks} required disabled={!editable}/>
          <Field label="Account Number" name="bank_account_number" defaultValue={profile.bank_account_number??""} disabled={!editable}/>
          <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={profile.bank_ifsc_code??""} disabled={!editable}/>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <Header number="2" title="Documents" subtitle="Upload or replace only the required files. The final account route is controlled by the automatic IIB result."/>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          <DocumentCard label="Marksheet" current={currentMarksheet?.file_name}><Select label="Marksheet Type" name="education_document_type" defaultValue={currentMarksheet?.document_type??""} options={marksheetOptions.map(([value,label])=>({value,label}))} disabled={!editable}/><FileReplacement name="education_marksheet" current={currentMarksheet?.file_name} disabled={!editable}/></DocumentCard>
          {documentFields.map(([documentType,label])=>{const current=documents.find(document=>document.document_type===documentType);return <DocumentCard key={documentType} label={label} current={current?.file_name}><FileReplacement name={documentType} current={current?.file_name} disabled={!editable}/></DocumentCard>})}
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE5EF] bg-gradient-to-r from-[#F8FAFF] to-[#F5F3FF] p-4">
        <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#071D49] text-[10px] font-bold text-white">3</span><div><h3 className="text-[12px] font-semibold text-[#0F172A]">Final review</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">Use the compact workflow panel to confirm the IIB route and mark the file ready for onboarding.</p></div></div>
      </section>
    </div>
    <div className="sticky bottom-0 z-10 flex justify-end border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur">{editable?<FormSubmitButton label="Save primary details & documents" pendingLabel="Saving"/>:null}</div>
  </form>;
}

function Header({number,title,subtitle}:{number:string;title:string;subtitle:string}){return <div className="flex items-start gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p></div></div>}
function DocumentCard({label,current,children}:{label:string;current?:string;children:React.ReactNode}){return <div className={`rounded-xl border p-3 ${current?"border-emerald-200 bg-emerald-50/35":"border-amber-200 bg-amber-50/30"}`}><div className="mb-3 flex items-center justify-between"><span className="text-[10.5px] font-semibold">{label}</span><span className={`rounded-full px-2 py-0.5 text-[8.5px] font-semibold ${current?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{current?"Received":"Pending"}</span></div>{children}</div>}
function Field({label,name,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string;name:string}){return <div><label className={labelClass}>{label}{props.required?" *":""}</label><input name={name} className={inputClass} {...props}/></div>}
function Select({label,name,options,required,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string;name:string;options:ReadonlyArray<{value:string;label:string}>;required?:boolean}){return <div><label className={labelClass}>{label}{required?" *":""}</label><select name={name} required={required} className={inputClass} {...props}><option value="">Select {label.toLowerCase()}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
function FileReplacement({name,current,disabled}:{name:string;current?:string;disabled:boolean}){return <div><p className={`truncate text-[9.5px] ${current?"text-emerald-700":"text-[#64748B]"}`}>{current??"Not received"}</p>{!disabled?<input name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="mt-2 block w-full text-[9.5px] text-[#475569] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]"/>:null}</div>}