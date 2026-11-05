import { FileText, Files } from "lucide-react";
import { CustomerClaimMultipleUpload } from "./customer-claim-multiple-upload";
import { CustomerClaimCompactDocument, type CustomerClaimFile } from "./customer-claim-compact-document";

const definitions=[
  {label:"Accident Photo",type:"Accident Photo",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"RC Copy",type:"RC Copy",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Insurance Copy",type:"Insurance Copy",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Driver Licence",type:"Driver Licence",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"GR / Load Bill",type:"GR / Load Bill",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Accident Video",type:"Accident Video",accept:"video/mp4,video/quicktime,video/webm"},
  {label:"Incident Voice Note",type:"Incident Voice Note",accept:"audio/mp4,audio/x-m4a,audio/m4a,audio/webm,audio/ogg"},
];
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
function match(type:string, expected:string) {
  return normalize(type)===normalize(expected) ||
    (expected==="Incident Voice Note"&&["audio","voicenote","incidentaudio"].includes(normalize(type))) ||
    (expected==="Accident Photo"&&["spotphoto","accidentphotos"].includes(normalize(type)));
}

export function CustomerClaimEvidenceWorkspace({documents,claimId,accountId,stage,returnToSpotIntimation=false,allowUpload=true,onlyUploaded=false,canReusePolicyCopy=false}:{
documents:CustomerClaimFile[];claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean;allowUpload?:boolean;onlyUploaded?:boolean;canReusePolicyCopy?:boolean
}) {
  // Existing bulk uploads retain the original document_type for Operations verification.
  // Only presentation changes: both editable and completed views share this file list.
  const multipleDocuments = documents.filter(doc => normalize(doc.document_type) === "otherdocument");
  return <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white">
    <header className="border-b border-[#D9E3F0] px-4 py-3"><h2 className="text-[17px] font-semibold text-[#071D49]">Claim Documents</h2></header>
    <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      {definitions.filter(item=>!onlyUploaded||documents.some(doc=>match(doc.document_type,item.type))).map(item=><CustomerClaimCompactDocument key={item.type} label={item.label} type={item.type} accept={item.accept} documents={documents.filter(doc=>match(doc.document_type,item.type))} claimId={claimId} accountId={accountId} stage={stage} returnToSpotIntimation={returnToSpotIntimation} allowUpload={allowUpload && item.type !== "Incident Voice Note"} canReusePolicyCopy={item.type === "Insurance Copy" && canReusePolicyCopy}/>)}
    </div>
    {(allowUpload || multipleDocuments.length > 0) ? (
      <section aria-label="Multiple Documents" className="mx-3 mb-3 rounded-xl border border-[#D9E3F0] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#102B54]"><Files className="h-4 w-4 text-[#2460B8]" aria-hidden="true"/>Multiple Documents</h3>
          <span className="text-[11px] font-semibold text-[#087A57]">{multipleDocuments.length} Uploaded</span>
        </div>
        {multipleDocuments.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {multipleDocuments.map(doc => (
              <a key={doc.id} href={`/customer/claim-documents/${encodeURIComponent(doc.id)}/open?account=${encodeURIComponent(accountId)}&claim=${encodeURIComponent(claimId)}`}
                target="_blank" rel="noopener noreferrer" title={doc.file_name || "Uploaded document"}
                className="flex min-w-0 items-center gap-2 rounded-lg border border-[#CCD4DF] bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#204D83] transition-colors hover:border-[#AEBBCB] hover:bg-[#F1F5F9] focus-visible:outline-2 focus-visible:outline-[#1769DC]">
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true"/>
                <span className="truncate">{doc.file_name || "Uploaded document"}</span>
              </a>
            ))}
          </div>
        ) : null}
        {allowUpload ? <CustomerClaimMultipleUpload claimId={claimId} accountId={accountId} stage={stage} returnToSpotIntimation={returnToSpotIntimation}/> : null}
      </section>
    ) : null}
  </section>;
}
