/**
 * Check contradictions inside New India goods-carrying vehicle schedules.
 *
 * Make/Model and Variant are separate insurer statements. Do not guess
 * which is correct or reclassify an active manufacturer from the other cell.
 * Only block when both cells explicitly name conflicting Intra V-series
 * models. Missing fields continue through existing insurer/source checks.
 */
export function niaIntraModelVariantConflict(sourceText:string):boolean {
  const flat=sourceText.replace(/\u00a0/g," ").replace(/\s+/g," ");
  const model=/\bMake\s*\/\s*Model\s*:\s*TATA\s+MOTOR\s*\/\s*TATA\s+INTRA\s+V(\d{2})\b[\s\S]{0,160}?\bRegistration\s+no\./i.exec(flat);
  const variant=/\bVariant\s*:\s*INTRA\s+V(\d{2})\b/i.exec(flat);
  return !!model && !!variant && model[1]!==variant[1];
}
