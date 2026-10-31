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

export function CustomerClaimEvidenceWorkspace({documents,claimId,accountId,stage,returnToSpotIntimation=false,allowUpload=true,onlyUploaded=false}:{
documents:CustomerClaimFile[];claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean;allowUpload?:boolean;onlyUploaded?:boolean
}) {
  return <section className="overflow-hidden rounded-2xl border border-[#D9E3F0] bg-white">
    <header className="border-b border-[#D9E3F0] px-4 py-3"><h2 className="text-[17px] font-semibold text-[#071D49]">Claim Documents</h2></header>
    <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      {definitions.filter(item=>!onlyUploaded||documents.some(doc=>match(doc.document_type,item.type))).map(item=><CustomerClaimCompactDocument key={item.type} label={item.label} type={item.type} accept={item.accept} documents={documents.filter(doc=>match(doc.document_type,item.type))} claimId={claimId} accountId={accountId} stage={stage} returnToSpotIntimation={returnToSpotIntimation} allowUpload={allowUpload}/>)}
    </div>
    {allowUpload?<div className="px-3 pb-3"><CustomerClaimMultipleUpload claimId={claimId} accountId={accountId} stage={stage} returnToSpotIntimation={returnToSpotIntimation}/></div>:null}
  </section>;
}
