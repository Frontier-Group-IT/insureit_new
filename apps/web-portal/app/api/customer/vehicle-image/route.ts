import { NextResponse } from "next/server";
import { resolveCustomerWebScope,loadCustomerWebVehicles } from "@/lib/customer-web-data";
import { loadVehicleImageCatalog } from "@/lib/vehicle-image-catalog";
import { normalizeVehicleImageKey,resolveVehicleImage } from "@/lib/vehicle-image-match";
export const dynamic="force-dynamic";
const missing=()=>new NextResponse(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,accountId=params.get("account"),vehicleId=params.get("vehicle");
 if(!accountId||!vehicleId)return missing();
 const {account}=await resolveCustomerWebScope(accountId);
 const vehicle=(await loadCustomerWebVehicles(account.id)).find(v=>v.id===vehicleId);
 if(!vehicle||!vehicle.model)return missing();
 try{
 const {admin,manufacturerId}=await loadVehicleImageCatalog();
 const id=manufacturerId(vehicle.make);if(!id)return missing();
 const {data,error}=await admin.from("vehicle_image_master").select("manufacturer_id,model_key,variant_key,model_year,is_active,storage_path").eq("manufacturer_id",id).eq("model_key",normalizeVehicleImageKey(vehicle.model)).eq("is_active",true);
 if(error)return missing();
 const path=resolveVehicleImage({manufacturerId:id,model:vehicle.model,year:vehicle.year},(data??[]).map(r=>({manufacturerId:r.manufacturer_id,model:r.model_key,variant:r.variant_key,year:r.model_year,active:r.is_active,path:r.storage_path})));
 if(!path)return missing();
 const object=await admin.storage.from("vehicle-images").download(path);if(object.error||!object.data)return missing();
 return new NextResponse(await object.data.arrayBuffer(),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return missing();}
}
