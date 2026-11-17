/**
 * Policy issuance/issue date is an independent document fact; it must never
 * be inferred from OD/TP coverage start or from the current calendar date.
 *
 * These literal-label parsers are intentionally narrow for ICICI 3005 only.
 * A missing or contradictory label requires manual review.
 */
export type IssuanceEvidence = {
  key: string;
  value: string;
  evidence: string;
};

const MONTHS: Record<string, number> = {
  jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,
  may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,
  oct:10,october:10,nov:11,november:11,dec:12,december:12,
};

// Do not accept generic "date", policy inception date, premium-payment date,
// certificate issue date of a previous policy, or proposal date.
export const ICICI_ISSUANCE_LABEL =
  /^(?:policy\s+(?:issued\s+on|issue\s+date|issuance\s+date)|date\s+of\s+(?:policy\s+)?(?:issue|issuance)|issue\s+date)$/i;

export function validIsoIssuanceDate(date: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date+"T00:00:00.000Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10)===date;
}

function toIso(year: number, month: number, day: number): string | null {
  const value = String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");
  return validIsoIssuanceDate(value) ? value : null;
}

/** A date must appear immediately after an explicit issuance label. */
function parsePrintedDate(raw: string): string | null {
  const value = raw.trim().replace(/^[\s:–-]+/,"");
  let m = value.match(/^(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/);
  if (m) return toIso(+m[1],+m[2],+m[3]);
  // Indian insurer documents use DD/MM/YYYY, not American MM/DD/YYYY.
  m = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})(?!\d)/);
  if (m) return toIso(+m[3],+m[2],+m[1]);
  m = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(20\d{2})(?!\d)/);
  if (m) return toIso(+m[3],MONTHS[m[2].toLowerCase()]??0,+m[1]);
  m = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(20\d{2})(?!\d)/);
  if (m) return toIso(+m[3],MONTHS[m[1].toLowerCase()]??0,+m[2]);
  return null;
}

export function extractIcici3005PolicyIssuanceDate(pdfText: string):
  { date: string; label: string } | null {
  const lines = pdfText.replace(/\r/g,"\n").replace(/\u00a0/g," ")
    .split("\n").map(line=>line.trim()).filter(Boolean);
  const candidates: Array<{date:string;label:string}> = [];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    // Label may occur after another heading on the line. Only the exact
    // issuance label is accepted, never one of the coverage period labels.
    const match=line.match(/\b(?:Policy\s+(?:Issued\s+On|Issue\s+Date|Issuance\s+Date)|Date\s+of\s+(?:Policy\s+)?(?:Issue|Issuance)|Issue\s+Date)\b\s*[:–-]?\s*/i);
    if(!match) continue;
    const label=match[0].trim().replace(/[:–-]\s*$/,"").trim();
    if(!ICICI_ISSUANCE_LABEL.test(label))continue;
    const rest=line.slice((match.index??0)+match[0].length);
    const value=parsePrintedDate(rest)
      ?? (rest.trim()==="" ? parsePrintedDate(lines[i+1]??"") : null);
    if(value)candidates.push({date:value,label});
  }
  // Conflicting printed date evidence is never resolved by choosing a guess.
  if(!candidates.length||candidates.some(v=>v.date!==candidates[0].date))return null;
  return candidates[0];
}

export function verifiedN8nPolicyIssuanceDate(fields: readonly IssuanceEvidence[]): string {
  const matches=fields.filter(field=>field.key==="policy_issuance_date");
  if(matches.length!==1)return "";
  const field=matches[0];
  return validIsoIssuanceDate(field.value) && ICICI_ISSUANCE_LABEL.test(field.evidence)
    ? field.value:"";
}
