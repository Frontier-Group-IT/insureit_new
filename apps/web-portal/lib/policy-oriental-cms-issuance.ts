/**
 * Source-bound Oriental issuance date from the actual PDF CMS signing time.
 * The printed 'Policy Printed On' line is never an issuance-date substitute.
 * This is CMS integrity verification, NOT issuer certificate-chain trust.
 * No PDF content, signature material, storage URL or policy PII is logged.
 */
import {createHash} from "node:crypto";
import {fromBER} from "asn1js";
import {ContentInfo,SignedData} from "pkijs";
export type OrientalSignedIssuanceEvidence={
  date:string; documentSha256:string;
  verification:"detached_signature_integrity_verified";
  source:"cms_signed_attribute_signing_time";
};
const RANGE=/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
const MAX_BYTES=15*1024*1024;
function indiaDay(instant:Date):string|null {
  if(!Number.isFinite(instant.getTime()))return null;
  const p=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(instant);
  const get=(key:string)=>p.find(x=>x.type===key)?.value??"";
  const day=get("year")+"-"+get("month")+"-"+get("day");
  const parsed=new Date(day+"T00:00:00Z");
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day?day:null;
}
function pdfMToIndiaDay(value:string):string|null {
  const match=/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-])(\d{2})'?(\d{2})'?$/.exec(value);
  if(!match)return null;
  const [y,mo,d,h,mi,s,sign,zh,zm]=[...match.slice(1,7),match[7],match[8],match[9]];
  const nums=[y,mo,d,h,mi,s,zh,zm].map(Number);
  const [year,month,day,hour,minute,sec,tzHour,tzMin]=nums;
  if(month<1||month>12||day<1||day>31||hour>23||minute>59||sec>59
    ||tzHour>14||tzMin>59)return null;
  const utc=Date.UTC(year,month-1,day,hour,minute,sec);
  const roundTrip=new Date(utc);
  if(roundTrip.getUTCFullYear()!==year||roundTrip.getUTCMonth()!==month-1
    ||roundTrip.getUTCDate()!==day)return null;
  const offset=(tzHour*60+tzMin)*60_000*(sign==="+"?1:-1);
  return indiaDay(new Date(utc-offset));
}
/** ASN.1 GeneralizedTime may contain an explicit +HHMM/-HHMM offset.
 * Some ASN.1 Date adapters normalize this format inconsistently; parse the
 * encoded signed-attribute instant strictly rather than guessing local time.
 * The CMS signature is still verified over signedAttrs before acceptance.
 */
export function cmsSigningTimeIndiaDay(
  value:string, fallbackDate?:Date,
):string|null {
  const offset=/^(\\d{4})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})([+-])(\\d{2})(\\d{2})$/.exec(value);
  if(!offset)return fallbackDate?indiaDay(fallbackDate):null;
  const [,yy,mm,dd,hh,mi,ss,sign,oh,om]=offset;
  const [year,month,day,hour,minute,second,tzHour,tzMin]=[yy,mm,dd,hh,mi,ss,oh,om].map(Number);
  if(month<1||month>12||day<1||day>31||hour>23||minute>59||second>59
    ||tzHour>14||tzMin>59||(tzHour===14&&tzMin!==0))return null;
  const local=Date.UTC(year,month-1,day,hour,minute,second);
  const check=new Date(local);
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1
    ||check.getUTCDate()!==day)return null;
  const minutes=(tzHour*60+tzMin)*(sign==="+"?1:-1);
  return indiaDay(new Date(local-minutes*60000));
}

/** Resolve one current-document, full-coverage, detached CMS signature.
 * CMS signedAttrs signingTime is integrity-protected by the CMS signature.
 * PDF /M, if present, MUST agree on India business day. Never use /M alone.
 */
export async function verifyOrientalCmsSigningDate(
  bytes:Uint8Array,
):Promise<OrientalSignedIssuanceEvidence|null>{
 const hold=(stage:string):null=>{
   console.warn("[oriental-cms] verification hold",{stage});
   return null;
 };
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<1024||bytes.byteLength>MAX_BYTES)
   return hold("byte_limits");
 const raw=Buffer.from(bytes).toString("latin1");
 if(!raw.startsWith("%PDF-"))return hold("pdf_header");
 const ranges=[...raw.matchAll(RANGE)];
 if(ranges.length!==1)return hold("range_count");
 const [firstStart,firstLen,secondStart,secondLen]=ranges[0].slice(1).map(Number);
 if(![firstStart,firstLen,secondStart,secondLen].every(Number.isSafeInteger)
   ||firstStart!==0||firstLen<=0||secondLen<=0
   ||secondStart<=firstLen||secondStart+secondLen!==bytes.byteLength)
   return hold("range_coverage");
 const gap=raw.slice(firstLen,secondStart);
 if(!/^<[0-9A-Fa-f]{1024,65536}>$/.test(gap))return hold("contents_slot");
 // /Contents can precede /ByteRange, /SubFilter and /M inside the SAME
 // signature dictionary. Inspect the signed dictionary around the CMS slot,
 // never an unrelated earlier PDF object or the unsigned gap itself.
 const dictStart=raw.lastIndexOf("<<",firstLen);
 const dictEnd=raw.indexOf(">>",secondStart);
 if(dictStart<0||dictEnd<0||firstLen-dictStart>2000
   ||dictEnd-secondStart>3000)return hold("dictionary_bounds");
 const beforeCms=raw.slice(dictStart,firstLen);
 const afterCms=raw.slice(secondStart,dictEnd+2);
 if(!/\/Contents\s*$/.test(beforeCms))return hold("contents_marker");
 const dictionary=beforeCms+" "+afterCms;
 if(!/\/Type\s*\/Sig\b/.test(dictionary))return hold("signature_type");
 const filters=[...dictionary.matchAll(/\/SubFilter\s*\/([A-Za-z0-9.]+)/g)];
 if(filters.length!==1||!["adbe.pkcs7.detached","ETSI.CAdES.detached"].includes(filters[0][1]))
   return hold("signature_subfilter");
 const declaredRanges=[...dictionary.matchAll(RANGE)];
 if(declaredRanges.length!==1||declaredRanges[0].slice(1).map(Number).join(",")!==
   [firstStart,firstLen,secondStart,secondLen].join(","))return hold("dictionary_range_identity");
 const pdfM=[...dictionary.matchAll(/\/M\s*\((D:[^)]{14,28})\)/g)];
 if(pdfM.length>1)return hold("multiple_pdf_m");
 try{
   const padded=Buffer.from(gap.slice(1,-1),"hex");
   const parsed=fromBER(padded);
   if(parsed.offset<=0||parsed.offset>padded.length
     ||padded.subarray(parsed.offset).some(byte=>byte!==0))return hold("asn1_padding");
   const envelope=ContentInfo.fromBER(padded.subarray(0,parsed.offset));
   if(envelope.contentType!==ContentInfo.SIGNED_DATA)return hold("cms_content_type");
   const cms=new SignedData({schema:envelope.content});
   if(cms.signerInfos.length!==1||cms.encapContentInfo.eContent)return hold("cms_signer_shape");
   const attrs=cms.signerInfos[0].signedAttrs?.attributes||[];
   const signedTime=attrs.filter(a=>a.type==="1.2.840.113549.1.9.5");
   if(signedTime.length!==1||signedTime[0].values.length!==1)return hold("cms_signing_time_missing");
   const asn=signedTime[0].values[0] as {
     toDate?:()=>Date;valueBlock?:{value?:unknown};
   };
   const encoded=asn.valueBlock?.value;
   if(typeof encoded!=="string"&&typeof asn.toDate!=="function")
     return hold("cms_signing_time_type");
   // Explicit-offset GeneralizedTime must not be interpreted as local UTC.
   const day=typeof encoded==="string"&&/^[0-9]{14}[+-][0-9]{4}$/.test(encoded)
     ?cmsSigningTimeIndiaDay(encoded)
     :typeof asn.toDate==="function"?indiaDay(asn.toDate()):null;
   if(!day)return hold("cms_time_date_invalid");
   if(pdfM.length===1&&pdfMToIndiaDay(pdfM[0][1])!==day)return hold("pdf_m_mismatch");
   const full=Buffer.concat([
     Buffer.from(bytes.subarray(0,firstLen)),
     Buffer.from(bytes.subarray(secondStart,secondStart+secondLen)),
   ]);
   const valid=await cms.verify({
     signer:0,data:Uint8Array.from(full).buffer,checkChain:false,
   });
   if(!valid)return hold("cms_cryptographic_verify_false");
   return {date:day,documentSha256:createHash("sha256").update(bytes).digest("hex"),
     verification:"detached_signature_integrity_verified",
     source:"cms_signed_attribute_signing_time"};
 }catch{return hold("cms_exception");}
}
