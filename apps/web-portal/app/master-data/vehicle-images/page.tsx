import { AppShell, PageHeader, Card } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadObservedVehicleModels } from "@/lib/vehicle-image-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VehicleImageUpload } from "./upload";
export const dynamic = "force-dynamic";
export default async function VehicleImageMasterPage() {
 const profile = await requireCapability("manage_master_data");
 const editable = await hasEffectiveCapability(profile,"manage_master_data","edit");
 const [catalog, mappings] = await Promise.all([loadObservedVehicleModels(),createSupabaseAdminClient().from("vehicle_image_master").select("id,manufacturer_id,model_key,variant_key,model_year,is_active").eq("is_active",true).order("model_key").limit(1000)]);
 if(mappings.error) throw new Error("Vehicle Image Master is unavailable. Verify the migration before enabling this feature.");
 return <AppShell title="Vehicle Image Master"><PageHeader title="Vehicle Image Master" description="Upload model-specific vehicle artwork for the Customer Portal."/><Card><p className="text-sm">Observed models: {catalog.models.length} · Unmatched vehicle records: {catalog.unmatched}</p>{editable && <VehicleImageUpload models={catalog.models}/>}</Card><Card><h2 className="font-bold">Active image register</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Manufacturer</th><th>Model</th><th>Variant</th><th>Year</th></tr></thead><tbody>{(mappings.data??[]).map(row=><tr key={row.id}><td>{catalog.models.find(m=>m.manufacturerId===row.manufacturer_id)?.make??"Unknown"}</td><td>{row.model_key}</td><td>{row.variant_key??"All"}</td><td>{row.model_year??"All"}</td></tr>)}</tbody></table></div></Card></AppShell>;
}
