/**
 * Check a contradiction INSIDE a New India goods-carrying vehicle schedule.
 *
 * The Make/Model and Variant cells are separate insurer-origin statements.
 * This is not a manufacturer-master alias or permission to guess which one
 * is correct. Fail closed only when both explicitly name different Intra
 * V-series variants; absent/malformed cells are handled by the existing
 * canonical source validation.
 */
export function niaIntraModelVariantConflict(sourceText:string):boolean {
  const flat=sourceText.replace(/\\u00a0/g," ").replace(/\\s+/g," ");
  const block=/\\bMake\\s*\\/\\s*Model\\s*:\\s*TATA\\s+MOTOR\\s*\\/\\s*TATA\\s+INTRA\\s+V(\\d{2})\\b[\\s\\S]{0,125}?\\bRegistration\\s+no\\./i.exec(flat);
  const variant=/\\bVariant\\s*:\\s*INTRA\\s+V(\\d{2})\\b/i.exec(flat);
  return !!block&&!!variant&&block[1]!==variant[1];
}
