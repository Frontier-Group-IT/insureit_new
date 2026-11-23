// Partner customer creation and private document staging without Vercel.
// Replicates the website's idempotent customer code, validated source
// assignment and creator-only document admission with file signature checks.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GST=/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const TYPES=new Set(["pan_copy","aadhaar_front","aadhaar_back","gst_copy"]);
const EXT:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};
const MAX_BYTES=4*1024*1024;
const reply=(data:Record<string,unknown>,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}
});
const trimmed=(x:unknown,max:number)=>typeof x==="string"?x.trim().slice(0,max):"";
const optional=(s:string)=>s||null;
async function codeFor(uid:string,requestId:string){
  const bytes=new TextEncoder().encode(uid+":"+requestId);
  const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return "CUST-"+Array.from(hash.slice(0,10)).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return reply({ok:false,error:"Method not allowed."},405);
  const token=/^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization")??"")?.[1];
  if(!token)return reply({ok:false,error:"Sign in again to continue."},401);
  let body:Record<string,unknown>;
  try{body=await req.json();}catch{return reply({ok:false,error:"Invalid customer request."},400);}
  const action=body.action??"create";
  if(!["create","prepare_document","finalize_document"].includes(String(action)))
    return reply({ok:false,error:"Unsupported customer request."},400);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),
    secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return reply({ok:false,error:"Customer service is temporarily unavailable."},503);
  const scoped=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:userError}=await scoped.auth.getUser(token);
  if(userError||!user.user)return reply({ok:false,error:"Partner session expired."},401);
  const [{data:identity,error:identityError},{data:scope,error:scopeError}]=await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope")
  ]);
  if(identityError||scopeError)return reply({ok:false,error:"Customer authorization unavailable."},503);
  if(!identity||!scope||identity.auth_user_id!==user.user.id||identity.actor_kind!==scope.actor_kind||
     !["employee","intermediary"].includes(identity.actor_kind)||scope.scope_mode==="none")
    return reply({ok:false,error:"Customer creation is not authorized."},403);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(identity.actor_kind==="employee"){
    if(identity.profile_id!==user.user.id)return reply({ok:false,error:"Employee identity mismatch."},403);
    const {data:permission,error:permError}=await scoped.rpc("partner_app_effective_permissions");
    if(permError)return reply({ok:false,error:"Employee permissions temporarily unavailable."},503);
    if(!permission||!["edit","approve"].includes(permission.capabilities?.create_customers))
      return reply({ok:false,error:"Customer creation permission required."},403);
  }
  if(action==="create"){
    const name=trimmed(body.customer_name,160),mobile=trimmed(body.mobile,20);
    const requestId=trimmed(body.requestId,80);
    if(!/^[a-z0-9_-]{12,80}$/i.test(requestId))
      return reply({ok:false,error:"Missing customer request identifier."},400);
    const customerCode=await codeFor(user.user.id,requestId);
    const email=trimmed(body.email,254).toLowerCase();
    const pan=trimmed(body.pan_number,15).toUpperCase();
    const aadhaar=trimmed(body.aadhaar_number,20).replace(/\s/g,"");
    const pin=trimmed(body.pin_code,10);
    const gstRegistered=body.gst_registered===true;
    const gstNumber=trimmed(body.gst_number,20).toUpperCase();
    const tradeName=trimmed(body.legal_trade_name,200);
    if(!name||!/^[6-9]\d{9}$/.test(mobile))return reply({ok:false,error:"Valid name and mobile are required."},400);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply({ok:false,error:"Invalid email address."},400);
    if(pan&&!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan))
      return reply({ok:false,error:"Invalid PAN."},400);
    if(aadhaar&&!/^\d{12}$/.test(aadhaar))
      return reply({ok:false,error:"Invalid Aadhaar number."},400);
    if(pin&&!/^\d{6}$/.test(pin))
      return reply({ok:false,error:"Invalid PIN."},400);
    if(gstRegistered&&(!GST.test(gstNumber)||!tradeName))
      return reply({ok:false,error:"GSTIN and Legal Trade Name are required."},400);
    const ids=Array.isArray(scope.intermediary_ids)
      ?scope.intermediary_ids.filter((x:unknown)=>typeof x==="string"&&UUID.test(x)):[];
    let sourceId:string|null=null;
    if(identity.actor_kind==="intermediary"){
      if(identity.intermediary_id&&ids.includes(identity.intermediary_id))sourceId=identity.intermediary_id;
      else if(ids.length===1)sourceId=ids[0];
      else return reply({ok:false,error:"Select one approved customer source in Operations."},403);
    }else if(scope.scope_mode!=="organization"){
      if(ids.length!==1)return reply({ok:false,error:"Multiple sources require selection in Operations."},403);
      sourceId=ids[0];
    }
    const {data:prior,error:priorError}=await admin.from("customers")
      .select("id,contact_name,phone,created_by").eq("customer_code",customerCode).maybeSingle();
    if(priorError)return reply({ok:false,error:"Customer lookup temporarily unavailable."},503);
    if(prior){
      if(prior.created_by!==user.user.id||prior.contact_name!==name||prior.phone!==mobile)
        return reply({ok:false,error:"Request identifier belongs to another customer."},409);
      return reply({ok:true,customerId:prior.id});
    }
    const {data:saved,error:saveError}=await admin.from("customers").insert({
      customer_code:customerCode,contact_name:name,phone:mobile,email:optional(email),
      address:optional([trimmed(body.street,200),trimmed(body.locality,150)].filter(Boolean).join(", ")),
      address_street:optional(trimmed(body.street,200)),address_locality:optional(trimmed(body.locality,150)),
      city:optional(trimmed(body.city,100)),state:optional(trimmed(body.state,100)),
      postal_code:optional(pin),pincode:optional(pin),pan_number:optional(pan),
      aadhaar_last_four:aadhaar?aadhaar.slice(-4):null,
      legal_trade_name:gstRegistered?tradeName:optional(tradeName),
      is_gst_registered:gstRegistered,gst_number:gstRegistered?gstNumber:null,
      gstin:gstRegistered?gstNumber:null,lead_source_intermediary_id:sourceId,
      created_by:user.user.id,creation_channel:"legacy",source:"Partner App",status:"active"
    }).select("id").single();
    if(saveError?.code==="23505"){
      const {data:existing}=await admin.from("customers")
        .select("id,contact_name,phone,created_by").eq("customer_code",customerCode).maybeSingle();
      if(existing?.created_by===user.user.id&&existing.contact_name===name&&existing.phone===mobile)
        return reply({ok:true,customerId:existing.id});
    }
    if(saveError||!saved)return reply({ok:false,error:"Customer could not be created. Check your list before retrying."},422);
    return reply({ok:true,customerId:saved.id},201);
  }
  const customerId=typeof body.customerId==="string"?body.customerId:"";
  const type=typeof body.type==="string"?body.type:"";
  const name=typeof body.name==="string"?body.name:"";
  const mime=typeof body.mimeType==="string"?body.mimeType:"";
  const size=body.size;
  if(!UUID.test(customerId)||!TYPES.has(type)||!name.trim()||name.length>180||
     !Object.hasOwn(EXT,mime)||typeof size!=="number"||!Number.isSafeInteger(size)||size<1||size>MAX_BYTES)
    return reply({ok:false,error:"Only PDF/JPG/PNG documents under 4 MB are allowed."},400);
  const {data:customer,error:customerError}=await admin.from("customers")
    .select("id,created_by,is_gst_registered").eq("id",customerId).maybeSingle();
  if(customerError)return reply({ok:false,error:"Customer ownership temporarily unavailable."},503);
  if(!customer||customer.created_by!==user.user.id||(type==="gst_copy"&&!customer.is_gst_registered))
    return reply({ok:false,error:"Document upload is not authorized for this customer."},403);
  const {data:inScope,error:scopeError2}=await scoped.rpc("partner_app_customer_in_scope",{p_customer_id:customerId});
  if(scopeError2)return reply({ok:false,error:"Customer scope temporarily unavailable."},503);
  if(inScope!==true)return reply({ok:false,error:"Customer is outside your authorized scope."},403);
  const {data:existing,error:existingError}=await admin.from("customer_documents")
    .select("id").eq("customer_id",customerId).eq("document_type",type)
    .eq("uploaded_by",user.user.id).limit(1).maybeSingle();
  if(existingError)return reply({ok:false,error:"Customer document lookup unavailable."},503);
  if(existing)return reply({ok:true,alreadySaved:true});
  if(action==="prepare_document"){
    const path=customerId+"/"+type+"/"+crypto.randomUUID()+"."+EXT[mime];
    const {data:prepared,error}=await admin.storage.from("customer-documents")
      .createSignedUploadUrl(path,{upsert:false});
    if(error||!prepared?.token)return reply({ok:false,error:"Secure customer upload unavailable."},503);
    return reply({ok:true,path,token:prepared.token});
  }
  const path=typeof body.path==="string"?body.path:"";
  if(!new RegExp("^"+customerId+"/"+type+"/[0-9a-f-]{36}\\."+EXT[mime]+"$","i").test(path))
    return reply({ok:false,error:"Invalid document upload reference."},400);
  const {data:info,error:infoError}=await admin.storage.from("customer-documents").info(path);
  if(infoError||!info)return reply({ok:false,error:"File upload is not finished."},409);
  if(info.size!==size||info.contentType!==mime)return reply({ok:false,error:"Uploaded file does not match the selected document."},400);
  const {data:download,error:downloadError}=await admin.storage.from("customer-documents").download(path);
  if(downloadError||!download)return reply({ok:false,error:"Uploaded file format could not be verified."},503);
  const bytes=new Uint8Array(await download.arrayBuffer());
  if(bytes.length!==size)return reply({ok:false,error:"Uploaded file size changed."},400);
  const signature=mime==="application/pdf"
    ?bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70
    :mime==="image/png"?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71
    :bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!signature)return reply({ok:false,error:"Selected file does not match its format."},400);
  const {error:writeError}=await admin.from("customer_documents").insert({
    customer_id:customerId,document_type:type,file_name:name,
    storage_bucket:"customer-documents",storage_path:path,mime_type:mime,
    file_size:size,uploaded_by:user.user.id,upload_source:"manager_portal",
    verification_status:"pending"
  });
  if(writeError){
    const {data:after}=await admin.from("customer_documents").select("id")
      .eq("customer_id",customerId).eq("document_type",type)
      .eq("uploaded_by",user.user.id).maybeSingle();
    if(after)return reply({ok:true,alreadySaved:true});
    return reply({ok:false,error:"Uploaded document could not be registered. Retry without re-uploading."},503);
  }
  return reply({ok:true},201);
});
