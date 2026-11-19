/**
 * A *proposal*, not an electronic-signature trust decision or an issuance
 * certification. PDF /M is a claimed signing timestamp. The site deliberately
 * requires an authorized operator to compare the original policy and approve
 * a proposed date before placing it in an editable onboarding draft.
 *
 * No external URLs, network access, PDF execution or private PDF persistence.
 */
import { createHash } from "node:crypto";

export type PolicyIssuanceDateEvidence = {
  proposedDate: string;
  receiptDate: string;
  source: "embedded_pdf_signature_timestamp";
  verification: "metadata_only_requires_reviewer";
  documentSha256: string;
  requiresReviewerConfirmation: true;
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
 * receipt evidence. ByteRange coverage is not cryptographic CMS verification.
 * The result MUST NEVER be accepted as independently verified issuance.
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
    verification:"metadata_only_requires_reviewer",
    documentSha256:createHash('sha256').update(bytes).digest('hex'),
    requiresReviewerConfirmation:true,
  };
}