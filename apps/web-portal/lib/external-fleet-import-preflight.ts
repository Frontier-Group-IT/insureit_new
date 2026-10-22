/**
 * External fleet bulk import preflight. No write to vehicles is permitted here.
 * The calling workflow must verify customer scope and existing DB RC/chassis conflicts
 * and obtain a successful trusted AuthBridge RC response before commit.
 */
export type ExternalFleetSourceRow = {
 sourceRow: number;
 registrationNumber: string | null;
 chassisNumber: string;
 engineNumber: string;
 modelYear: number;
 emissionNorm: string;
};
export type ExistingFleetKey = { registrationNumber: string | null; chassisNumber: string | null; customerId: string };
export type FleetImportPreflight = ExternalFleetSourceRow & {
 status: "already_linked" | "conflict_other_customer" | "requires_authbridge" | "manual_unregistered" | "invalid" | "source_duplicate";
 reason: string;
};
const normalize = (value: string | null | undefined) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export function preflightExternalFleetRows(
 rows: ExternalFleetSourceRow[],
 existing: ExistingFleetKey[],
 targetCustomerId: string,
): FleetImportPreflight[] {
 const byChassis = new Map<string, ExistingFleetKey[]>();
 const byRc = new Map<string, ExistingFleetKey[]>();
 for (const e of existing) {
  const ch = normalize(e.chassisNumber), rc = normalize(e.registrationNumber);
  if(ch)byChassis.set(ch,[...(byChassis.get(ch)??[]),e]);
  if(rc && !rc.startsWith("NEW"))byRc.set(rc,[...(byRc.get(rc)??[]),e]);
 }
 const seenChassis = new Set<string>(), seenRc = new Set<string>();
 return rows.map(row => {
  const ch=normalize(row.chassisNumber),rc=normalize(row.registrationNumber);
  let status:FleetImportPreflight["status"]="requires_authbridge",reason="Fetch and validate Detailed RC before import";
  if(!ch || ch.length<12 || (rc && !/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(rc))) {
   status="invalid";reason="Invalid chassis or registration number";
  }else if(seenChassis.has(ch) || (rc && seenRc.has(rc))) {
   status="source_duplicate";reason="Duplicate identifier in the import batch";
  }else{
   const matches=[...(byChassis.get(ch)??[]),...(rc?byRc.get(rc)??[]:[])];
   const other=matches.find(e=>e.customerId!==targetCustomerId);
   const own=matches.find(e=>e.customerId===targetCustomerId);
   if(other){status="conflict_other_customer";reason="Existing record belongs to another customer; manual review required";}
   else if(own){status="already_linked";reason="Existing vehicle on target account; do not reinsert";}
   else if(!rc){status="manual_unregistered";reason="No RC: chassis and source documents require manual approval";}
  }
  seenChassis.add(ch);if(rc)seenRc.add(rc);
  return {...row,status,reason};
 });
}
