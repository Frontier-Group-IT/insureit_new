import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { requireCapability } from "@/lib/master-data-server";
import { loadObservedVehicleModels } from "@/lib/vehicle-image-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeVehicleImageKey } from "@/lib/vehicle-image-match";
export const runtime="nodejs";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function POST(request:Request){
 const profile=await requireCapability("manage_master_data","edit");
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("Invalid origin",403);
 if(Number(request.headers.get("content-length")||0)>2300000)return fail("File too large",413);
 let form:FormData;try{form=await request.formData();}catch{return fail("Invalid upload");}
 const image=form.get("image"),manufacturerId=String(form.get("manufacturerId")??""),model=normalizeVehicleImageKey(String(form.get("model")??""));
 if(!(image instanceof File)||image.size<1||image.size>2097152||image.type!=="image/webp"||!model||model.length>240)return fail("Invalid image or model");
 const {models}=await loadObservedVehicleModels();
 if(!models.some(m=>m.manufacturerId===manufacturerId&&m.model===model))return fail("Model is not in the observed catalogue");
 let data:Buffer,width:number,height:number;
 try{const decoder=sharp(Buffer.from(await image.arrayBuffer()),{limitInputPixels:1080000,failOn:"error"});const metadata=await decoder.metadata();if(metadata.format!=="webp"||(metadata.pages??1)!==1)return fail("Only still WebP images are allowed");const output=await decoder.resize({width:1200,height:900,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true});data=output.data;width=output.info.width;height=output.info.height;}catch{return fail("Image cannot be decoded");}
 if(data.length>2097152)return fail("Optimized image too large");
 const admin=createSupabaseAdminClient();
 const hash=createHash("sha256").update(data).digest("hex");
 const existing=await admin.from("vehicle_image_master").select("id").eq("manufacturer_id",manufacturerId).eq("model_key",model).is("variant_key",null).is("model_year",null).eq("is_active",true).maybeSingle();
 if(existing.error)return fail("Unable to verify existing mapping",503);
 if(existing.data)return fail("An active image already exists for this model",409);
 const id=randomUUID(),path=manufacturerId+"/"+id+".webp";
 const stored=await admin.storage.from("vehicle-images").upload(path,data,{contentType:"image/webp",upsert:false});
 if(stored.error)return fail("Image storage failed",503);
 const inserted=await admin.from("vehicle_image_master").insert({id,manufacturer_id:manufacturerId,model_key:model,storage_path:path,content_hash:hash,image_width:width,image_height:height,file_size:data.length,created_by:profile.id,updated_by:profile.id});
 if(inserted.error){await admin.storage.from("vehicle-images").remove([path]);return fail("Mapping could not be saved; check for an existing image",409);}
 return NextResponse.json({id},{status:201});
}
