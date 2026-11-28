import { NextResponse } from "next/server";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { createCustomerServerSupabaseClient } from "@/lib/auth-server";
import { loadVehicleImageCatalog } from "@/lib/vehicle-image-catalog";
import { resolveVehicleImage } from "@/lib/vehicle-image-match";
import { vehicleFamily,resolveFamilyArtwork } from "@/lib/vehicle-image-family";
export const dynamic="force-dynamic";
const missing=()=>new NextResponse(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,accountId=params.get("account"),vehicleId=params.get("vehicle");
 if(!accountId||!vehicleId)return missing();
 const {account}=await resolveCustomerWebScope(accountId);
 const supabase=await createCustomerServerSupabaseClient();
 const scoped=await supabase.from("vehicles").select("make,model,year").eq("customer_id",account.id).eq("id",vehicleId).maybeSingle();
 const vehicle=scoped.error?null:scoped.data;
 if(!vehicle||!vehicle.model)return missing();
 try{
 const {admin,manufacturerId}=await loadVehicleImageCatalog();
 const family=vehicleFamily(vehicle.model);
 const id=manufacturerId(family?.make??vehicle.make);if(!id)return missing();
 const {data,error}=await admin.from("vehicle_image_master").select("manufacturer_id,model_key,variant_key,model_year,is_active,storage_path").eq("manufacturer_id",id).eq("is_active",true).order("id").limit(1000);
 if(!family&&data?.length===1000)return missing();
 if(error)return missing();
 if(data?.length===1000)return missing();
 const familyPath=family?resolveFamilyArtwork(vehicle.model,(data??[]).map(r=>({model:r.model_key,variant:r.variant_key,year:r.model_year,active:r.is_active,path:r.storage_path}))):null;
 const path=family?familyPath:resolveVehicleImage({manufacturerId:id,model:vehicle.model,year:vehicle.year},(data??[]).map(r=>({manufacturerId:r.manufacturer_id,model:r.model_key,variant:r.variant_key,year:r.model_year,active:r.is_active,path:r.storage_path})));
 if(!path)return missing();
 const object=await admin.storage.from("vehicle-images").download(path);if(object.error||!object.data)return missing();
 return new NextResponse(await object.data.arrayBuffer(),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return missing();}
}
