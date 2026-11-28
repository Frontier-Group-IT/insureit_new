import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeVehicleImageKey as key } from "@/lib/vehicle-image-match";
import { vehicleFamily } from "@/lib/vehicle-image-family";
export type CatalogItem = { manufacturerId: string; make: string; model: string; type: string; count: number; years: number[] };
export async function loadVehicleImageCatalog() {
 const admin=createSupabaseAdminClient();
 const [m,a,b]=await Promise.all([
  admin.from("vehicle_manufacturers").select("id,name,display_name").eq("is_active",true),
  admin.from("vehicle_manufacturer_aliases").select("manufacturer_id,alias").eq("is_active",true),
  admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true)
 ]);
 if(m.error||a.error||b.error) throw new Error("Unable to load manufacturer master.");
 const names=new Map<string,Set<string>>();
 const add=(name:string,id:string)=>{const k=key(name);if(!k)return; const set=names.get(k)??new Set<string>();set.add(id);names.set(k,set);};
 const display=new Map<string,string>();
 for(const row of m.data??[]){display.set(row.id,row.display_name||row.name);add(row.name,row.id);add(row.display_name,row.id);}
 for(const row of a.data??[])if(display.has(row.manufacturer_id))add(row.alias,row.manufacturer_id);
 for(const row of b.data??[])if(display.has(row.manufacturer_id))add(row.brand_name,row.manufacturer_id);
 const manufacturerId=(name:string|null)=>{const ids=names.get(key(name));return ids?.size===1?[...ids][0]:null;};
 return {admin,display,manufacturerId};
}
export async function loadObservedVehicleModels(){
 const {admin,display,manufacturerId}=await loadVehicleImageCatalog();
 const rows=new Map<string,CatalogItem>();let unmatched=0;
 for(let offset=0;;offset+=500){
  const {data,error}=await admin.from("vehicles").select("make,model,vehicle_type,year").order("id").range(offset,offset+499);
  if(error)throw new Error("Unable to load observed vehicle models.");
  for(const v of data??[]){
   const family=vehicleFamily(v.model);
   const id=family?manufacturerId(family.make):manufacturerId(v.make),model=family?.model??key(v.model);
   if(!id||!model){unmatched++;continue;}
   const k=id+"|"+model;
   const old=rows.get(k);
   if(old){old.count++;if(Number.isInteger(v.year)&&!old.years.includes(v.year))old.years.push(v.year);}else rows.set(k,{manufacturerId:id,make:family?.make??display.get(id)??v.make,model,type:v.vehicle_type??"",count:1,years:Number.isInteger(v.year)?[v.year]:[]});
  }
  if(!data||data.length<500)break;
 }
 return {models:[...rows.values()].map(m=>({...m,years:m.years.sort((a,b)=>b-a)})).sort((a,b)=>(a.make+" "+a.model).localeCompare(b.make+" "+b.model,"en",{numeric:true,sensitivity:"base"})),unmatched};
}
