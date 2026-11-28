import {vehicleFamily, familyKey} from "./vehicle-image-family.ts";
import type {CatalogItem} from "./vehicle-image-catalog";
export type ImageMapping={id:string;manufacturer_id:string;model_key:string;variant_key:string|null;model_year:number|null;version:string;is_active:boolean};
export type RegisterRow={key:string;manufacturerId:string;make:string;model:string;count:number;uploadable:boolean;mappings:ImageMapping[];preview:ImageMapping|null;status:"uploaded"|"pending"|"review"};
export function buildVehicleImageRegister(models:CatalogItem[],mappings:ImageMapping[],names:Record<string,string>){
 const key=(id:string,model:string)=>JSON.stringify([id,model]);
 const rows=new Map<string,RegisterRow>();
 for(const m of models){const k=key(m.manufacturerId,m.model);rows.set(k,{key:k,manufacturerId:m.manufacturerId,make:m.make,model:m.model,count:m.count,uploadable:true,mappings:[],preview:null,status:"pending"});}
 for(const mapping of mappings){if(!mapping.is_active)continue;const family=vehicleFamily(mapping.model_key);const candidate=family?rows.get(key(mapping.manufacturer_id,family.model)):undefined;
 const k=candidate?.key??key(mapping.manufacturer_id,mapping.model_key);
 let row=rows.get(k);if(!row){row={key:k,manufacturerId:mapping.manufacturer_id,make:names[mapping.manufacturer_id]??"Unknown make",model:mapping.model_key,count:0,uploadable:false,mappings:[],preview:null,status:"pending"};rows.set(k,row);}row.mappings.push(mapping);
 }
 for(const row of rows.values()){
 const general=row.mappings.filter(m=>!m.variant_key&&m.model_year==null);
 const exact=general.filter(m=>familyKey(m.model_key)===familyKey(row.model));
 const candidates=exact.length?exact:general;
 row.preview=candidates.length===1?candidates[0]:null;
 row.status=row.preview?"uploaded":row.mappings.length?"review":"pending";
 }
 return [...rows.values()].sort((a,b)=>(a.make+" "+a.model).localeCompare(b.make+" "+b.model,"en",{numeric:true,sensitivity:"base"}));
}
