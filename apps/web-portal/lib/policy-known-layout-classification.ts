/** Exact native-PDF product family recognition for intake diagnostics.
 * Unlike an insurer-only dispatch, a two-wheeler Package must never enter the
 * Oriental Goods Carrier parser. Never infer a policy from the lead source.
 */
export type PolicyLayoutDiagnostic =
  | "n8n_layout_untrained_liberty_two_wheeler_tp"
  | "n8n_layout_untrained_oriental_two_wheeler_package";
export function classifyKnownUntrainedPolicyLayout(text:string):PolicyLayoutDiagnostic|null{
 const head=text.slice(0,16000).replace(/\s+/g," ").toUpperCase();
 if(/\bLIBERTY GENERAL INSURANCE LIMITED\b/.test(head)
  &&/\bTWO WHEELER LIABILITY ONLY POLICY\s*\(\s*1 YEAR TP ONLY\s*\)/.test(head)
  &&/INSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION/.test(head))
   return "n8n_layout_untrained_liberty_two_wheeler_tp";
 if(/THE ORIENTAL INSURANCE COMPANY LIMITED/.test(head)
   &&/MOTORISED-TWO WHEELERS PACKAGE POLICY\s*-\s*ZONE [A-C]/.test(head)
   &&/MOTOR INSURANCE CERTIFICATE CUM POLICY SCHEDULE/.test(head))
   return "n8n_layout_untrained_oriental_two_wheeler_package";
 return null;
}
