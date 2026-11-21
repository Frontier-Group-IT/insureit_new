/**
 * Audited insurer model-family mapping, not a per-policy-number exception.
 * Use only when both the exact IFFCO machine model and independently sourced
 * manufacturer specification match. Never infer make/fuel from model prefix
 * alone, nor substitute model-derived values for PDF-printed fields silently.
 *
 * Sources:
 * JCB official VM117 product: https://www.jcb.com/en-IN/products/machines/single-drum-soil-compactors/vm117/
 * JCB VM117 NDD brochure (diesel, JCB engine):
 * https://5.imimg.com/data5/SELLER/Doc/2023/4/297729160/SY/PS/BZ/187354298/jcb-vm-117-compactor-road-roller.pdf
 * JCB 455-5N loader: https://www.jcb.com/en-IN/products/machines/wheel-loaders/455/
 * JCB 455-5N wheel-loader diesel engine specification:
 * https://5.imimg.com/data5/SELLER/Doc/2025/12/570866470/SM/ZN/RL/3763192/jcb-455-5n-wheel-loader.pdf
 */
export type InsurerMachineField={key:string;label:string;value:string;confidence:null;page:number|null;evidence:string};
const VM117_NDD=/^VMT?\s*117\s+LC\s+NDD\s+COMPACTOR$/i;
const JCB_455_5N=/^JCB\s+455[- ]5N\s+(?:WHEEL\s+)?LOADER$/i;
export function enrichIffcoCertifiedMachineFamily<T extends InsurerMachineField>(
  fields:readonly T[], parserId:string,
):T[]{
  if(parserId!=="iffco_tokio_cv_native_pdf")return [...fields];
  const current=new Map(fields.map(f=>[f.key,f]));
  const model=current.get("vehicle_model")?.value.trim()??"";
  const make=current.get("vehicle_make")?.value.trim()??"";
  const fuel=current.get("vehicle_fuel_type")?.value.trim()??"";
  // IFFCO schedule uses VMT 117 LC NDD; this exact NDD model family is
  // consistent with the manufacturer-listed JCB VM117 NDD compactor.
  // Do not apply this to generic VMT, a different compactor, or explicit
  // conflicting PDF-printed make/fuel.
  const vm117=VM117_NDD.test(model)&&["VMT","VM117","JCB",""].includes(make.toUpperCase());
  const loader455=JCB_455_5N.test(model)&&make.toUpperCase()==="JCB";
  if((!vm117&&!loader455)||(fuel&&fuel.toUpperCase()!=="DIESEL"))return [...fields];
  const result=[...fields];
  const addOrReplace=(key:string,value:string,evidence:string)=>{
    const index=result.findIndex(f=>f.key===key);
    const field={key,label:key,value,confidence:null,page:null,evidence} as T;
    if(index===-1)result.push(field);
    else result[index]=field;
  };
  if(vm117)addOrReplace("vehicle_make","JCB",
    "Manufacturer-model JCB VM117 NDD specification; model-derived from IFFCO VMT 117 LC NDD, NOT a PDF-printed make");
  // Preserve the PDF-printed JCB make on the loader; only fill a missing
  // fuel type and never override a conflicting printed Electric/Hydrogen.
  if(!fuel)addOrReplace("vehicle_fuel_type","Diesel",
    vm117?"Manufacturer-model Diesel specification (JCB VM117 NDD); NOT PDF-printed"
      :"Manufacturer-model Diesel specification (JCB 455-5N wheel loader); NOT PDF-printed");
  return result;
}
