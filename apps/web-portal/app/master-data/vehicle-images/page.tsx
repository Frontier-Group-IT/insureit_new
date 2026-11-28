import { AppShell, PageHeader, Card } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadObservedVehicleModels,loadVehicleImageCatalog } from "@/lib/vehicle-image-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VehicleImageRegister } from "./register";
import {vehicleFamily,familyKey} from "@/lib/vehicle-image-family";
import { buildVehicleImageRegister,type ImageMapping } from "@/lib/vehicle-image-register";
export const dynamic = "force-dynamic";
export default async function VehicleImageMasterPage() {
 const profile = await requireCapability("manage_master_data");
 const editable = await hasEffectiveCapability(profile,"manage_master_data","edit");
 const [catalog, master] = await Promise.all([loadObservedVehicleModels(),loadVehicleImageCatalog()]);
 const mappings:ImageMapping[]=[];
 const admin=createSupabaseAdminClient();
 for(let offset=0;;offset+=500){
  const result=await admin.from("vehicle_image_master").select("id,manufacturer_id,model_key,variant_key,model_year,is_active,version").eq("is_active",true).order("id").range(offset,offset+499);
  if(result.error)throw new Error("Vehicle Image Master is unavailable.");
  mappings.push(...(result.data??[]));if((result.data??[]).length<500)break;
 }
 const rows=buildVehicleImageRegister(catalog.models,mappings,Object.fromEntries(master.display),vehicleFamily,familyKey);
 return <AppShell title="Vehicle Image Master"><PageHeader title="Vehicle Image Master" description="Manage model-specific vehicle artwork for the Customer Portal."/><Card><VehicleImageRegister rows={rows} editable={editable} observed={catalog.models.length} unmatched={catalog.unmatched}/></Card></AppShell>;
}
