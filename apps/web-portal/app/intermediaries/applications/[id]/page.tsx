import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";
export const revalidate=0;

type Application={id:string;requested_type:"posp"|"misp";final_type:"posp"|"misp"|"partner"|null;status:string;registration_status:string;partner_status:string|null;applicant_phone:string|null;applicant_email:string|null;created_at:string;updated_at:string};
type Profile={partner_id:string|null;partner_type:"posp"|"misp";external_onboarding_id:string|null;document_received_at:string|null;pos_name:string|null;misp_name:string|null;applicant_phone:string|null;applicant_email:string|null;date_of_birth:string|null;aadhaar_last_four:string|null;pan_number:string|null;gst_number:string|null;address:string|null;city:string|null;state:string|null;postal_code:string|null;bank_name:string|null;bank_account_number:string|null;bank_ifsc_code:string|null;oem_name:string|null;dp_name:string|null;dp_phone:string|null;dp_email:string|null;dp_pan_number:string|null;dp_date_of_birth:string|null;dp_aadhaar_last_four:string|null;workflow_stage:string;iib_remarks:string|null;iib_uploaded:boolean|null;iib_uploaded_at:string|null;training_status:string|null;training_certificate_number:string|null;exam_status:string|null;onboarding_date:string|null;associate_name:string|null};
type Assignment={training_status:string;training_title:string|null;training_assigned_at:string|null;training_started_at:string|null;training_completed_at:string|null;exam_status:string;exam_title:string|null;exam_score:number|null;exam_completed_at:string|null;agreement_status:string;agreement_sent_at:string|null;agreement_signed_at:string|null};
type Document={id:string;document_type:string;file_name:string;storage_bucket:string;storage_path:string;verification_status:string;created_at:string};
type Intermediary={id:string;intermediary_code:string|null;portal_access_status:string;account_status:string};

export default async function IntermediaryAccountReviewPage({params}:{params:Promise<{id:string}>}){
  await requirePospMispManager();
  const {id}=await params;
  const admin=createSupabaseAdminClient();
  const [{data:application},{data:profile},{data:assignment},{data:documents},{data:intermediary}]=await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,requested_type,final_type,status,registration_status,partner_status,applicant_phone,applicant_email,created_at,updated_at").eq("id",id).maybeSingle<Application>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_id,partner_type,external_onboarding_id,document_received_at,pos_name,misp_name,applicant_phone,applicant_email,date_of_birth,aadhaar_last_four,pan_number,gst_number,address,city,state,postal_code,bank_name,bank_account_number,bank_ifsc_code,oem_name,dp_name,dp_phone,dp_email,dp_pan_number,dp_date_of_birth,dp_aadhaar_last_four,workflow_stage,iib_remarks,iib_uploaded,iib_uploaded_at,training_status,training_certificate_number,exam_status,onboarding_date,associate_name").eq("application_id",id).maybeSingle<Profile>(),
    admin.from("intermediary_training_exam_assignments").select("training_status,training_title,training_assigned_at,training_started_at,training_completed_at,exam_status,exam_title,exam_score,exam_completed_at,agreement_status,agreement_sent_at,agreement_signed_at").eq("application_id",id).maybeSingle<Assignment>(),
    admin.from("intermediary_onboarding_documents").select("id,document_type,file_name,storage_bucket,storage_path,verification_status,created_at").eq("application_id",id).order("created_at").returns<Document[]>(),
    admin.from("intermediaries").select("id,intermediary_code,portal_access_status,account_status").eq("application_id",id).maybeSingle<Intermediary>()
  ]);
  if(!application||!profile)notFound();

  const isMisp=profile.partner_type==="misp";
  const name=(isMisp?profile.misp_name:profile.pos_name)??"Unnamed intermediary";
  const registrationLabel=isMisp?"MISP":"POSP";
  const lifecycle=deriveLifecycle(application,profile,assignment);
  const partnerId=profile.partner_id&&!profile.partner_id.startsWith("PENDING-")?profile.partner_id:null;
  const registrationId=application.registration_status==="iib_registered"&&intermediary?.intermediary_code&&!intermediary.intermediary_code.startsWith("PART-")&&!intermediary.intermediary_code.startsWith("PENDING-")?intermediary.intermediary_code:null;
  const workflowStage=nextWorkflowStage(profile,assignment,application);
  const requirements=buildRequirements(profile,assignment,documents??[],application);
  const journey=buildJourney(isMisp,profile,assignment,application);
  const contactPhone=isMisp?(profile.dp_phone??profile.applicant_phone):profile.applicant_phone;
  const contactEmail=isMisp?(profile.dp_email??profile.applicant_email):profile.applicant_email;
  const aadhaarLastFour=isMisp?profile.dp_aadhaar_last_four:profile.aadhaar_last_four;

  return <AppShell title="Intermediary Account Review">
    <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="flex flex-col gap-4 bg-[#071D49] px-5 py-5 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{name}</h1>{partnerId?<span className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">{partnerId}</span>:null}{registrationId?<span className="rounded-lg border border-cyan-200/30 bg-cyan-100/10 px-2.5 py-1 text-[10px] font-semibold">{registrationId}</span>:null}</div>
            <div className="mt-3 flex flex-wrap gap-2"><Badge value={application.partner_status??"pending_partner"}/><Badge value={lifecycle}/><Badge value={intermediary?.portal_access_status??"not_created"}/></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/intermediaries/applications/${id}/workflow?stage=${workflowStage}`} className="rounded-xl bg-white px-4 py-2.5 text-[10px] font-bold text-[#071D49]">Continue onboarding</Link>
            <Link href={`/intermediaries/applications/${id}/workflow?stage=primary`} className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[10px] font-semibold text-white">Edit details</Link>
            <Link href="/intermediaries/portal-users" className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-[10px] font-semibold text-white">Portal access</Link>
          </div>
        </div>
        <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Partner status" value={pretty(application.partner_status??"pending_partner")}/>
          <Metric label="Registration" value={registrationLabel}/>
          <Metric label="Registration status" value={pretty(application.registration_status)}/>
          <Metric label="Assigned RM" value={profile.associate_name??"Not assigned"}/>
          <Metric label="Portal status" value={pretty(intermediary?.portal_access_status??"not_created")}/>
          <Metric label="Last updated" value={formatDate(application.updated_at)}/>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-[#DCE5EF] bg-white p-2 shadow-sm">
        {["overview","details","registration","documents","portal","activity"].map(tab=><a key={tab} href={`#${tab}`} className="rounded-xl px-3 py-2 text-[10px] font-semibold capitalize text-[#475569] hover:bg-[#EEF2FF] hover:text-[#4338CA]">{tab}</a>)}
      </nav>

      <section id="overview" className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <div className="space-y-4">
          <Card title="Account summary">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Partner ID" value={partnerId??"Pending until documents are approved"}/>
              <Info label={`${registrationLabel} ID`} value={registrationId??"Not issued"}/>
              <Info label="Account type" value={isMisp?"Business Partner · MISP":"Individual Partner · POSP"}/>
              <Info label="Primary contact" value={contactPhone??"-"}/>
              <Info label="Email" value={contactEmail??"-"}/>
              <Info label="Location" value={[profile.city,profile.state].filter(Boolean).join(", ")||"-"}/>
            </dl>
          </Card>
          <Card title="Registration journey">
            <div className={`grid gap-2 ${journey.length===5?"sm:grid-cols-5":"sm:grid-cols-6"}`}>{journey.map(item=><Journey key={item.label} {...item}/>)}</div>
          </Card>
          <Card title="Open requirements" count={requirements.length}>
            {requirements.length?<div className="divide-y">{requirements.map(item=><div key={item.label} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-semibold text-[#17203A]">{item.label}</p><p className="mt-1 text-[9px] text-[#64748B]">{item.detail}</p></div><Link href={`/intermediaries/applications/${id}/workflow?stage=${item.stage}`} className="shrink-0 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-[9px] font-semibold text-[#4338CA]">Resolve</Link></div>)}</div>:<p className="py-6 text-center text-[11px] text-emerald-700">No onboarding requirements are currently pending.</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Recommended action">
            <div className="rounded-xl bg-[#EEF2FF] p-4"><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#6366F1]">Next best action</p><p className="mt-2 text-[14px] font-semibold text-[#17203A]">{requirements[0]?.label??"Account review complete"}</p><p className="mt-1 text-[9.5px] text-[#64748B]">{requirements[0]?.detail??"No onboarding action is currently required."}</p>{requirements[0]?<Link href={`/intermediaries/applications/${id}/workflow?stage=${requirements[0].stage}`} className="mt-4 inline-flex rounded-xl bg-[#071D49] px-4 py-2.5 text-[10px] font-semibold text-white">Open required stage</Link>:null}</div>
          </Card>
          <Card title="Quick actions">
            <div className="grid gap-2"><ActionLink href={`/intermediaries/applications/${id}/workflow?stage=primary`} label="Review primary details"/><ActionLink href={`/intermediaries/applications/${id}/workflow?stage=documents`} label="Review documents"/><ActionLink href={`/intermediaries/applications/${id}/workflow?stage=review`} label={isMisp?"Manage agreement and IIB":"Manage training, exam, agreement and IIB"}/><ActionLink href="/intermediaries/portal-users" label="Manage portal access"/></div>
          </Card>
        </div>
      </section>

      <section id="details" className="grid gap-4 lg:grid-cols-2">
        <Card title="Identity and contact"><dl className="grid gap-4 sm:grid-cols-2"><Info label="Name" value={name}/><Info label="PAN" value={maskPan(profile.pan_number)}/><Info label="Aadhaar" value={aadhaarLastFour?`Ending ${aadhaarLastFour}`:"Not available"}/><Info label="Date of birth" value={formatDate(isMisp?profile.dp_date_of_birth:profile.date_of_birth)}/><Info label="Mobile" value={contactPhone??"-"}/><Info label="Email" value={contactEmail??"-"}/>{isMisp?<><Info label="Designated person" value={profile.dp_name??"-"}/><Info label="OEM" value={profile.oem_name??"-"}/></>:null}</dl></Card>
        <Card title="Address, bank and tax"><dl className="grid gap-4 sm:grid-cols-2"><Info label="Address" value={profile.address??"-"}/><Info label="PIN code" value={profile.postal_code??"-"}/><Info label="Bank" value={profile.bank_name??"-"}/><Info label="Account" value={maskAccount(profile.bank_account_number)}/><Info label="IFSC" value={profile.bank_ifsc_code??"-"}/><Info label="GST" value={profile.gst_number??"Not applicable"}/></dl></Card>
      </section>

      <section id="registration"><Card title={`${registrationLabel} registration`}><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Registration status" value={pretty(application.registration_status)}/><Info label="Training" value={isMisp?"Not required":pretty(assignment?.training_status??profile.training_status??"not_assigned")}/><Info label="Exam" value={isMisp?"Not required":pretty(assignment?.exam_status??profile.exam_status??"not_allotted")}/><Info label="Agreement" value={pretty(assignment?.agreement_status??"not_started")}/><Info label="IIB" value={profile.iib_uploaded?"Uploaded":profile.iib_remarks==="No Data Found In POS System"?"Cleared":"Pending"}/><Info label="Training certificate" value={profile.training_certificate_number??"Not issued"}/><Info label="Onboarding date" value={formatDate(profile.onboarding_date)}/><Info label="Application updated" value={formatDate(application.updated_at)}/></dl></Card></section>

      <section id="documents"><Card title="Documents" count={(documents??[]).length}>{documents?.length?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documents.map(document=><DocumentRow key={document.id} document={document}/>)}</div>:<p className="py-8 text-center text-[11px] text-[#64748B]">No documents have been uploaded.</p>}</Card></section>

      <section id="portal"><Card title="Portal access"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Portal status" value={pretty(intermediary?.portal_access_status??"not_created")}/><Info label="Login email" value={contactEmail??"-"}/><Info label="Account status" value={pretty(intermediary?.account_status??"under_onboarding")}/><Info label="Linked Partner" value={partnerId??"Pending"}/></dl><div className="mt-4"><Link href="/intermediaries/portal-users" className="inline-flex rounded-xl bg-[#071D49] px-4 py-2.5 text-[10px] font-semibold text-white">Open portal user management</Link></div></Card></section>

      <section id="activity"><Card title="Activity"><div className="space-y-4 border-l border-[#CBD5E1] pl-4"><Activity title="Application updated" when={application.updated_at}/><Activity title="Application created" when={application.created_at}/>{profile.iib_uploaded_at?<Activity title="IIB details uploaded" when={profile.iib_uploaded_at}/>:null}{assignment?.agreement_signed_at?<Activity title="Agreement signed" when={assignment.agreement_signed_at}/>:null}{assignment?.training_completed_at?<Activity title="Training completed" when={assignment.training_completed_at}/>:null}</div></Card></section>
    </div>
  </AppShell>;
}

function deriveLifecycle(application:Application,profile:Profile,assignment:Assignment|null){if(application.registration_status==="iib_registered")return profile.partner_type==="misp"?"active_misp":"active_posp";if(profile.partner_status==="active_partner"||application.partner_status==="active_partner"){if(profile.partner_type==="posp"&&assignment?.training_status==="completed")return"training_completed";return"active_partner"}return application.registration_status}
function nextWorkflowStage(profile:Profile,assignment:Assignment|null,application:Application){if(profile.workflow_stage==="pre_iib")return"primary";if(profile.workflow_stage==="iib_processing")return"documents";if(application.registration_status==="iib_registered")return"review";if(profile.partner_type==="posp"&&assignment?.training_status!=="completed")return"review";return"review"}
function buildRequirements(profile:Profile,assignment:Assignment|null,documents:Document[],application:Application){const items:Array<{label:string;detail:string;stage:"primary"|"documents"|"review"}>=[];if(profile.workflow_stage==="pre_iib")items.push({label:"Complete primary information",detail:"Save the applicant identity, contact, address and banking details.",stage:"primary"});const required=["aadhaar_front","pan_copy","cancelled_cheque"];const types=new Set(documents.map(item=>item.document_type));if(required.some(type=>!types.has(type)))items.push({label:"Upload mandatory Partner documents",detail:"Aadhaar front, PAN copy and cancelled cheque are required before Partner activation.",stage:"documents"});if(profile.partner_type==="posp"){if(!assignment||["not_assigned","assigned","opened","in_progress"].includes(assignment.training_status))items.push({label:"Complete POSP training",detail:"Assign and complete the mandatory POSP training.",stage:"review"});else if(assignment.exam_status!=="passed")items.push({label:"Complete POSP examination",detail:"Allot the exam and record a passing result.",stage:"review"})}if((assignment?.agreement_status??"not_started")!=="signed")items.push({label:"Complete agreement",detail:"Prepare, send and obtain the signed intermediary agreement.",stage:"review"});if(application.registration_status!=="iib_registered")items.push({label:"Complete IIB registration",detail:"Prepare and submit the IIB registration details to issue the final account ID.",stage:"review"});return items}
function buildJourney(isMisp:boolean,profile:Profile,assignment:Assignment|null,application:Application){const partnerDone=profile.partner_status==="active_partner"||application.partner_status==="active_partner";const docsDone=profile.workflow_stage!=="pre_iib";const agreementDone=assignment?.agreement_status==="signed";const iibDone=application.registration_status==="iib_registered";if(isMisp)return[{label:"Partner",done:partnerDone,active:!partnerDone},{label:"Documents",done:docsDone,active:partnerDone&&!docsDone},{label:"Agreement",done:agreementDone,active:docsDone&&!agreementDone},{label:"IIB",done:iibDone,active:agreementDone&&!iibDone},{label:"MISP active",done:iibDone,active:false}];const trainingDone=assignment?.training_status==="completed";const examDone=assignment?.exam_status==="passed";return[{label:"Partner",done:partnerDone,active:!partnerDone},{label:"Training",done:trainingDone,active:partnerDone&&!trainingDone},{label:"Exam",done:examDone,active:trainingDone&&!examDone},{label:"Agreement",done:agreementDone,active:examDone&&!agreementDone},{label:"IIB",done:iibDone,active:agreementDone&&!iibDone},{label:"POSP active",done:iibDone,active:false}]}
function Card({title,count,children}:{title:string;count?:number;children:React.ReactNode}){return <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2>{typeof count==="number"?<span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{count}</span>:null}</div>{children}</section>}
function Metric({label,value}:{label:string;value:string}){return <div className="bg-white px-4 py-3"><p className="text-[8.5px] uppercase tracking-[.05em] text-[#64748B]">{label}</p><p className="mt-1 text-[11px] font-semibold text-[#17203A]">{value}</p></div>}
function Info({label,value}:{label:string;value:string}){return <div><dt className="text-[8.5px] uppercase tracking-[.05em] text-[#64748B]">{label}</dt><dd className="mt-1 break-words text-[11px] font-semibold text-[#17203A]">{value}</dd></div>}
function Badge({value}:{value:string}){return <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-semibold capitalize">{pretty(value)}</span>}
function Journey({label,done,active}:{label:string;done:boolean;active:boolean}){return <div className={`rounded-xl border px-3 py-3 text-center ${done?"border-emerald-200 bg-emerald-50":active?"border-[#C7D2FE] bg-[#EEF2FF]":"border-[#E2E8F0] bg-[#F8FAFC]"}`}><div className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold ${done?"bg-emerald-600 text-white":active?"bg-[#4F46E5] text-white":"bg-[#E2E8F0] text-[#64748B]"}`}>{done?"✓":active?"•":"–"}</div><p className="mt-2 text-[9px] font-semibold text-[#334155]">{label}</p></div>}
function ActionLink({href,label}:{href:string;label:string}){return <Link href={href} className="flex items-center justify-between rounded-xl border border-[#DCE5EF] px-3 py-3 text-[10px] font-semibold text-[#17203A] hover:border-[#C7D2FE] hover:bg-[#F8FAFF]"><span>{label}</span><span>→</span></Link>}
async function DocumentRow({document}:{document:Document}){const admin=createSupabaseAdminClient();const{data}=await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path,900);return <div className="rounded-xl border border-[#E2E8F0] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold capitalize text-[#17203A]">{pretty(document.document_type)}</p><p className="mt-1 max-w-[220px] truncate text-[8.5px] text-[#64748B]">{document.file_name}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold capitalize text-slate-700">{pretty(document.verification_status)}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-[8px] text-[#94A3B8]">{formatDate(document.created_at)}</span>{data?.signedUrl?<a href={data.signedUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-2.5 py-1.5 text-[8.5px] font-semibold">Open</a>:null}</div></div>}
function Activity({title,when}:{title:string;when:string}){return <div className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#6366F1]"/><p className="text-[10.5px] font-semibold text-[#17203A]">{title}</p><p className="mt-1 text-[8.5px] text-[#64748B]">{formatDateTime(when)}</p></div>}
function pretty(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())}
function maskPan(value:string|null){if(!value)return"Not available";const pan=value.toUpperCase();return pan.length>=7?`${pan.slice(0,2)}****${pan.slice(-3)}`:"Not available"}
function maskAccount(value:string|null){if(!value)return"Not available";return `•••• ${value.slice(-4)}`}
function formatDate(value:string|null|undefined){if(!value)return"-";const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(date)}
function formatDateTime(value:string|null|undefined){if(!value)return"-";const date=new Date(value);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(date)}
