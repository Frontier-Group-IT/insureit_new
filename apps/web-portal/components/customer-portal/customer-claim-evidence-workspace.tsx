import { CustomerClaimMultipleUpload } from "./customer-claim-multiple-upload";
import { CustomerClaimCompactDocument, type CustomerClaimFile } from "./customer-claim-compact-document";

const definitions=[
  {label:"Accident Photo",type:"Accident Photo",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"RC Copy",type:"RC Copy",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Insurance Copy",type:"Insurance Copy",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Driver Licence",type:"Driver Licence",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"GR / Load Bill",type:"GR / Load Bill",accept:".pdf,.jpg,.jpeg,.png,.webp,.heic"},
  {label:"Accident Video",type:"Accident Video",accept:"video/mp4,video/quicktime,video/webm"},
];
const normalize=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
function match(type:string, expected:string) {
  return normalize(type)===normalize(expected) ||
    (expected==="Incident Voice Note"&&["audio","voicenote","incidentaudio"].includes(normalize(type))) ||
    (expected==="Accident Photo"&&["spotphoto","accidentphotos"].includes(normalize(type)));
}

export function CustomerClaimEvidenceWorkspace({documents,claimId,accountId,stage,returnToSpotIntimation=false,allowUpload=true,onlyUploaded=false,canReusePolicyCopy=false,reuploadDocumentType,reuploadRequestId}:{
documents:CustomerClaimFile[];claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean;allowUpload?:boolean;onlyUploaded?:boolean;canReusePolicyCopy?:boolean;reuploadDocumentType?:string|null;reuploadRequestId?:string|null
}) {
  // Bulk uploads are stored as Other Document; category-specific uploads stay in their own cards.
  const multipleDocuments = documents.filter(doc => normalize(doc.document_type) === "otherdocument");
  return <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white">
    <header className="border-b border-[#D9E3F0] px-4 py-3"><h2 className="text-[17px] font-semibold text-[#071D49]">Claim Documents</h2></header>
    <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      {definitions.filter(item=>!onlyUploaded||documents.some(doc=>match(doc.document_type,item.type))).map(item=><CustomerClaimCompactDocument key={item.type} label={item.label} type={item.type} accept={item.accept} documents={documents.filter(doc=>match(doc.document_type,item.type))} claimId={claimId} accountId={accountId} stage={stage} returnToSpotIntimation={returnToSpotIntimation} reuploadTarget={Boolean(reuploadRequestId && reuploadDocumentType && match(item.type,reuploadDocumentType))} reuploadRequestId={reuploadRequestId && reuploadDocumentType && match(item.type,reuploadDocumentType) ? reuploadRequestId : undefined} allowUpload={(allowUpload && item.type !== "Incident Voice Note") || Boolean(reuploadRequestId && reuploadDocumentType && match(item.type,reuploadDocumentType))} canReusePolicyCopy={item.type === "Insurance Copy" && canReusePolicyCopy}/>)}
    </div>
    {(allowUpload || multipleDocuments.length > 0) ? <div id={reuploadDocumentType && normalize(reuploadDocumentType)==="otherdocument" ? "claim-reupload-target" : undefined} className="mx-3 mb-3">
      <CustomerClaimMultipleUpload documents={multipleDocuments} claimId={claimId} accountId={accountId} stage={stage} allowUpload={allowUpload || Boolean(reuploadRequestId && reuploadDocumentType && normalize(reuploadDocumentType)==="otherdocument")} reuploadRequestId={reuploadDocumentType && normalize(reuploadDocumentType)==="otherdocument" ? reuploadRequestId : null} returnToSpotIntimation={returnToSpotIntimation}/>
    </div> : null}
  </section>;
}
