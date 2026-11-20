export type ManufacturingYearEvidence = {
  year:string;
  source:"manufacturing_year" | "registration_year_fallback" | "missing";
};
export function resolveManufacturingYearEvidence(
  fields:readonly {key:string;value:string}[],
):ManufacturingYearEvidence;
