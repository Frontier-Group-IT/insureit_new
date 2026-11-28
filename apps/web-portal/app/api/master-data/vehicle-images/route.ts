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
 const yearText=String(form.get("year")??"");const year=yearText?Number(yearText):null;
 const replace=String(form.get("replace")??"")==="true";
 const {models}=await loadObservedVehicleModels();
 const catalog=models.find(m=>m.manufacturerId===manufacturerId&&m.model===model);
 if(!catalog|| (year!==null&&(!Number.isInteger(year)||!catalog.years.includes(year))))return fail("Model or year is not in the observed catalogue");
 let data:Buffer,width:number,height:number;
 try{const decoder=sharp(Buffer.from(await image.arrayBuffer()),{limitInputPixels:1080000,failOn:"error"});const metadata=await decoder.metadata();if(metadata.format!=="webp"||(metadata.pages??1)!==1)return fail("Only still WebP images are allowed");const output=await decoder.resize({width:1200,height:900,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true});data=output.data;width=output.info.width;height=output.info.height;}catch{return fail("Image cannot be decoded");}
 if(data.length>2097152)return fail("Optimized image too large");
 const admin=createSupabaseAdminClient();
 const hash=createHash("sha256").update(data).digest("hex");
 const lookup=admin.from("vehicle_image_master").select("id,version,storage_path").eq("manufacturer_id",manufacturerId).eq("model_key",model).is("variant_key",null).eq("is_active",true);
 const existing=await (year===null?lookup.is("model_year",null):lookup.eq("model_year",year)).maybeSingle();
 if(existing.error)return fail("Unable to verify existing mapping",503);
 if(existing.data&&!replace)return fail("An active image exists. Select replacement to overwrite.",409);
 const id=randomUUID(),path=manufacturerId+"/"+id+".webp";
 const stored=await admin.storage.from("vehicle-images").upload(path,data,{contentType:"image/webp",upsert:false});
 if(stored.error)return fail("Image storage failed",503);
 const fields={storage_path:path,content_hash:hash,image_width:width,image_height:height,file_size:data.length,updated_by:profile.id,updated_at:new Date().toISOString(),version:randomUUID()};
 const saved=existing.data?await admin.from("vehicle_image_master").update(fields).eq("id",existing.data.id).eq("version",existing.data.version).eq("is_active",true).select("id").maybeSingle():await admin.from("vehicle_image_master").insert({...fields,id,manufacturer_id:manufacturerId,model_key:model,model_year:year,created_by:profile.id}).select("id").single();
 if(saved.error||!saved.data){return fail("Mapping save could not be confirmed. Refresh before retrying.",409);}
 return NextResponse.json({id:saved.data.id},{status:201});
}

export async function GET(request:Request){
 await requireCapability("manage_master_data","view");
 const id=new URL(request.url).searchParams.get("id");
 if(!id||!/^[0-9a-f-]{36}$/i.test(id))return fail("Invalid mapping");
 const admin=createSupabaseAdminClient();
 const row=await admin.from("vehicle_image_master").select("storage_path").eq("id",id).maybeSingle();
 if(row.error||!row.data)return fail("Image not found",404);
 const object=await admin.storage.from("vehicle-images").download(row.data.storage_path);
 if(object.error||!object.data)return fail("Image not found",404);
 return new NextResponse(await object.data.arrayBuffer(),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
export async function PATCH(request:Request){
 const profile=await requireCapability("manage_master_data","edit");
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("Invalid origin",403);
 let body:{id?:string;version?:string};try{body=await request.json();}catch{return fail("Invalid request");}
 if(!body?.id||!body.version||! /^[0-9a-f-]{36}$/i.test(body.id)||! /^[0-9a-f-]{36}$/i.test(body.version))return fail("Invalid mapping");
 const admin=createSupabaseAdminClient();
 const result=await admin.from("vehicle_image_master").update({is_active:false,version:randomUUID(),updated_by:profile.id,updated_at:new Date().toISOString()}).eq("id",body.id).eq("version",body.version).eq("is_active",true).select("id").maybeSingle();
 if(result.error||!result.data)return fail("Mapping changed. Refresh and retry.",409);
 return NextResponse.json({id:result.data.id});
}
