/** Read-only explanation of a legacy generic booking hold.
 * Never use inferred display reasons as booking authorization.
 * Only exact current-document queue evidence may call this function.
 */
export function inferLegacyAiReviewReason(input:{
  sourceInsuredName:string;
  draftInsuredName:string;
  intakeMobile:string;
  currentVehicleOwnerName?:string|null;
  currentVehicleOwnerMobile?:string|null;
  hasCurrentVehicle:boolean;
}):"insured_name_mismatch"|"vehicle_ownership"|"customer_identity"|null {
  const norm=(value:string)=>value.normalize("NFKC").trim()
    .replace(/\s+/g," ").toLocaleUpperCase("en-IN");
  const source=norm(input.sourceInsuredName);
  const draft=norm(input.draftInsuredName);
  if(source.length>=2 && !draft)return "insured_name_mismatch";
  if(!source||!draft||source!==draft||!input.hasCurrentVehicle)return null;
  const owner=norm(input.currentVehicleOwnerName??"");
  const phone=(value:string)=>value.replace(/\D/g,"").slice(-10);
  if(owner&&owner!==source)return "vehicle_ownership";
  const prior=phone(input.currentVehicleOwnerMobile??"");
  const now=phone(input.intakeMobile);
  if(owner===source&&prior.length===10&&now.length===10&&prior!==now)
    return "customer_identity";
  return null;
}
