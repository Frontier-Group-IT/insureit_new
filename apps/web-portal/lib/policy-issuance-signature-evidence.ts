/**
 * Evidence for Tata AIG's configured issuance-date business rule. It binds the
 * PDF signing timestamp to a full-document ByteRange, Tata AIG signer label,
 * matching printed receipt date, and exact PDF hash. This is not PKI chain
 * validation; the insurer rule explicitly treats this matched date as final.
 *
 * No external URLs, network access, PDF execution or private PDF persistence.
 */
import { createHash } from "node:crypto";
import { fromBER } from "asn1js";
import { ContentInfo, SignedData } from "pkijs";

export type PolicyIssuanceDateEvidence = {
  proposedDate: string;
  receiptDate: string;
  source: "embedded_pdf_signature_timestamp";
  verification: "signature_metadata_receipt_match" | "detached_signature_integrity_verified";
  documentSha256: string;
  requiresReviewerConfirmation: boolean;
};

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const RANGE = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;

function validIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Parse signed PDF /M with an explicit timezone, in India's business date. */
function parsePdfSigningDate(value: string): string | null {
  const match = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-])(\d{2})'?(\d{2})'?$/.exec(value);
  if (!match) return null;
  const [,y,mo,d,h,mi,s,sign,tzh,tzm] = match;
  const nums = [y,mo,d,h,mi,s,tzh,tzm].map(Number);
  const [year,month,day,hour,minute,second,zoneHours,zoneMins] = nums;
  if (month<1 || month>12 || day<1 || day>31 || hour>23 || minute>59 || second>59 || zoneHours>14 || zoneMins>59) return null;
  const utc = Date.UTC(year,month-1,day,hour,minute,second);
  const date = new Date(utc);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month-1 || date.getUTCDate() !== day) return null;
  const offsetMs = (zoneHours*60+zoneMins)*60_000*(sign==='+'?1:-1);
  const instant = new Date(utc - offsetMs);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(instant);
  const val = (type:string)=>parts.find(p=>p.type===type)?.value??"";
  const indiaDay = `${val('year')}-${val('month')}-${val('day')}`;
  return validIsoDay(indiaDay)?indiaDay:null;
}

/**
 * Derive a candidate ONLY when one signed-document metadata envelope covers
 * the complete PDF and its signing day agrees with separately validated n8n
 * receipt evidence. CMS trust-chain validation is intentionally separate
 * from the agreed Tata AIG business rule and does not gate date acceptance.
 */
export function extractTataAigSigningDateProposal(
  bytes: Uint8Array, verifiedReceiptDate: string | null | undefined,
): PolicyIssuanceDateEvidence | null {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1_024
    || bytes.byteLength > MAX_PDF_BYTES || !verifiedReceiptDate
    || !validIsoDay(verifiedReceiptDate)) return null;
  const text = Buffer.from(bytes).toString('latin1');
  if (!text.startsWith('%PDF-')) return null;
  const matches = [...text.matchAll(RANGE)];
  // Multiple signatures/partial revisions require a separate human review.
  if (matches.length !== 1) return null;
  const item = matches[0];
  const [begin, firstLength, secondBegin, secondLength] = item.slice(1).map(Number);
  if (![begin,firstLength,secondBegin,secondLength].every(Number.isSafeInteger)
    || begin!==0 || firstLength<=0 || secondLength<=0
    || secondBegin<=firstLength || secondBegin+secondLength!==bytes.byteLength) return null;
  const excluded = text.slice(firstLength,secondBegin);
  // The only skipped bytes must be an actual CMS signature hex container.
  if (!/^<[0-9A-Fa-f]{1024,65536}>$/.test(excluded)) return null;
  const prelude = text.slice(Math.max(0,firstLength-1200),firstLength);
  if (!/\/SubFilter\s*\/adbe\.pkcs7\.detached\b/.test(prelude)
    || !/\/Name\s*\(TATA AIG\)/i.test(prelude)) return null;
  const dates = [...prelude.matchAll(/\/M\s*\((D:[^)]{14,28})\)/g)];
  if (dates.length!==1) return null;
  const signingDate = parsePdfSigningDate(dates[0][1]);
  if (!signingDate || signingDate !== verifiedReceiptDate) return null;
  return {
    proposedDate:signingDate,
    receiptDate:verifiedReceiptDate,
    source:"embedded_pdf_signature_timestamp",
    verification:"signature_metadata_receipt_match",
    documentSha256:createHash('sha256').update(bytes).digest('hex'),
    requiresReviewerConfirmation:true,
  };
}

/** Verify the detached CMS against exactly the two signed ByteRange segments.
 * Certificate-chain trust is a separate decision under the Tata AIG rule.
 */
export async function verifyTataAigSigningDateEvidence(
  bytes: Uint8Array, receiptDate: string | null | undefined,
): Promise<PolicyIssuanceDateEvidence | null> {
  const proposal=extractTataAigSigningDateProposal(bytes,receiptDate);
  if(!proposal)return null;
  try {
    const text=Buffer.from(bytes).toString("latin1");
    RANGE.lastIndex=0;
    const match=RANGE.exec(text);
    RANGE.lastIndex=0;
    if(!match)return null;
    const firstLength=Number(match[2]),secondBegin=Number(match[3]),secondLength=Number(match[4]);
    const container=text.slice(firstLength+1,secondBegin-1);
    const padded=Buffer.from(container,"hex");
    const parsed=fromBER(padded);
    if(parsed.offset<=0 || parsed.offset>padded.length
      || padded.subarray(parsed.offset).some(byte=>byte!==0))return null;
    const cms=ContentInfo.fromBER(padded.subarray(0,parsed.offset));
    if(cms.contentType!==ContentInfo.SIGNED_DATA)return null;
    const signed=new SignedData({schema:cms.content});
    if(signed.signerInfos.length!==1 || signed.encapContentInfo.eContent)return null;
    const content=Buffer.concat([
      Buffer.from(bytes.subarray(0,firstLength)),
      Buffer.from(bytes.subarray(secondBegin,secondBegin+secondLength)),
    ]);
    const valid=await signed.verify({signer:0,data:Uint8Array.from(content).buffer,checkChain:false});
    if(!valid)return null;
    return {...proposal,verification:"detached_signature_integrity_verified",requiresReviewerConfirmation:false};
  } catch {return null;}
}
