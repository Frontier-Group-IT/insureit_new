// IT-only Vercel-independent PDF verification. Strictly read-only.
// Requires INSUREIT_N8N_OCR_HEADER_SECRET and an approved self-hosted n8n endpoint.
// No service-role token, signed PDF URL or raw policy document is returned.
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_EXPECTED='https://n8n.nishant.uk/webhook/insureit-policy-intake-icici-v1';
const MAX_BYTES=15*1024*1024;
const ALLOWED_STATUS=new Set(['processing','ready_for_review','in_review','needs_attention']);
const KEYS=new Set([
  'policy_number','insurer_name','policy_product','policy_issuance_date','policy_start_date','policy_end_date',
  'third_party_start_date','third_party_end_date','third_party_policy_number','third_party_insurer_name',
  'insured_name','vehicle_make','vehicle_model','vehicle_class','vehicle_fuel_type','vehicle_motor_power_kw',
  'vehicle_capacity','vehicle_rto_state','vehicle_registration_status','vehicle_registration_number',
  'vehicle_engine_number','vehicle_chassis_number','vehicle_manufacturing_year','vehicle_rto_name',
  'idv','od_premium','tp_premium','cpa_premium'
]);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json','cache-control':'private, no-store'}
});
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const validFields=(payload:Record<string,unknown>)=>{
  if(!Array.isArray(payload.fields)||payload.fields.length<12||payload.fields.length>KEYS.size)return null;
  const found=new Set<string>();
  const fields:Array<{key:string;value:string;evidence:string}>=[];
  for(const f of payload.fields){
    if(!object(f)||typeof f.key!=='string'||!KEYS.has(f.key)||found.has(f.key)
      ||typeof f.value!=='string'||!f.value.trim()||f.value.length>500
      ||typeof f.evidence!=='string'||f.evidence.length>1000)return null;
    found.add(f.key);
    fields.push({key:f.key,value:f.value,evidence:f.evidence});
  }
  return fields;
};

Deno.serve(async(request:Request)=>{
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  const authorization=request.headers.get('authorization')??'';
  const jwt=/^Bearer (.+)$/.exec(authorization)?.[1];
  if(!jwt)return json({error:'not_authenticated'},401);
  const supabaseUrl=Deno.env.get('SUPABASE_URL')??'';
  const anon=Deno.env.get('SUPABASE_ANON_KEY')??'';
  const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
  if(!supabaseUrl||!anon||!serviceRole)return json({error:'service_not_configured'},503);
  const caller=createClient(supabaseUrl,anon,{
    global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}
  });
  const authenticated=await caller.auth.getUser(jwt);
  if(authenticated.error||!authenticated.data.user)return json({error:'not_authenticated'},401);
  const payload=await request.json().catch(()=>null);
  if(!object(payload)||typeof payload.intake_id!=='string'||!uuid.test(payload.intake_id)
    ||Object.keys(payload).some(key=>key!=='intake_id'))return json({error:'invalid_request'},400);
  const id=payload.intake_id;

  // Independently reauthorize each request using the same server-owned
  // IT role/effective permission check as the Partner AI Studio read RPC.
  const access=await caller.rpc('partner_app_ai_studio_detail_v1',{p_intake_id:id});
  if(access.error||!object(access.data)||access.data.id!==id)
    return json({error:'not_authorized_or_intake_missing'},403);

  const endpoint=Deno.env.get('INSUREIT_N8N_OCR_WEBHOOK_URL')??'';
  const secret=Deno.env.get('INSUREIT_N8N_OCR_HEADER_SECRET')??'';
  if(endpoint!==URL_EXPECTED||secret.length<32)
    return json({error:'n8n_not_configured'},503);
  const admin=createClient(supabaseUrl,serviceRole,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const [record,document]=await Promise.all([
    admin.from('policy_intake_requests').select(
      'id,status,policy_type,processing_lane,storage_bucket,storage_path,mime_type,final_policy_id'
    ).eq('id',id).maybeSingle(),
    admin.from('policy_intake_documents').select(
      'id,storage_bucket,storage_path,mime_type,file_size,is_current'
    ).eq('intake_id',id).eq('is_current',true).maybeSingle()
  ]);
  const intake=record.data,doc=document.data;
  if(record.error||document.error||!intake||!doc
    ||!ALLOWED_STATUS.has(intake.status)||intake.policy_type!=='motor'
    ||intake.processing_lane!=='automation'||intake.final_policy_id
    ||intake.storage_bucket!=='policy-documents'||doc.storage_bucket!=='policy-documents'
    ||intake.storage_path!==doc.storage_path
    ||!doc.storage_path.startsWith('intakes/'+id+'/')
    ||intake.mime_type!=='application/pdf'||doc.mime_type!=='application/pdf'
    ||doc.is_current!==true||!Number.isSafeInteger(doc.file_size)
    ||doc.file_size<=0||doc.file_size>MAX_BYTES
  )return json({error:'intake_not_eligible'},409);

  const signed=await admin.storage.from('policy-documents').createSignedUrl(doc.storage_path,120);
  if(signed.error||!signed.data?.signedUrl)return json({error:'current_pdf_unavailable'},503);
  const source=new URL(signed.data.signedUrl);
  if(source.origin!==supabaseUrl||!source.pathname.startsWith(
    '/storage/v1/object/sign/policy-documents/intakes/'+id+'/')
    ||!source.searchParams.get('token')||source.username||source.password||source.hash)
    return json({error:'invalid_signed_source'},503);

  const requestId=crypto.randomUUID();
  let parsed:unknown;
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),55_000);
  try{
    const response=await fetch(endpoint,{
      method:'POST',signal:abort.signal,redirect:'error',cache:'no-store',
      headers:{'content-type':'application/json','x-insureit-policy-intake-secret':secret},
      body:JSON.stringify({
        intake_id:id,document_id:doc.id,request_id:requestId,signed_pdf_url:source.toString()
      })
    });
    if(!response.ok)return json({error:'n8n_verification_unavailable'},502);
    parsed=await response.json();
  }catch{
    return json({error:'n8n_verification_unavailable'},502);
  }finally{clearTimeout(timeout);}
  if(!object(parsed)||parsed.contract_version!=='1'
    ||parsed.intake_id!==id||parsed.document_id!==doc.id||parsed.request_id!==requestId
    ||parsed.ok!==true||parsed.review_required!==true
    ||parsed.auto_finalize_allowed!==false
    ||parsed.extraction_method!=='native_pdf_text'
    ||typeof parsed.parser_id!=='string'||!/^[a-z0-9_]{6,100}$/.test(parsed.parser_id)
    ||typeof parsed.parser_version!=='string'||parsed.parser_version.length>80
    ||!object(parsed.checks)||Object.keys(parsed.checks).length<12
    ||Object.keys(parsed.checks).length>40
    ||Object.values(parsed.checks).some(x=>x!==true)
    ||!Array.isArray(parsed.warnings)||parsed.warnings.length!==0
  )return json({error:'verification_failed'},422);
  const fields=validFields(parsed);
  if(!fields)return json({error:'verification_failed'},422);

  // Recheck current-document pointer and intake lifecycle AFTER n8n returns.
  // This is a read-only preview: not sufficient for booking or draft replacement.
  const [after,afterDocument]=await Promise.all([
    admin.from('policy_intake_requests').select('status,final_policy_id,storage_path')
      .eq('id',id).maybeSingle(),
    admin.from('policy_intake_documents').select('id').eq('intake_id',id)
      .eq('is_current',true).maybeSingle()
  ]);
  if(after.error||afterDocument.error||!after.data||!afterDocument.data
    ||afterDocument.data.id!==doc.id||after.data.storage_path!==doc.storage_path
    ||!ALLOWED_STATUS.has(after.data.status)||after.data.final_policy_id)
    return json({error:'document_changed'},409);
  return json({ok:true,intake_id:id,document_id:doc.id,parser_id:parsed.parser_id,
    parser_version:parsed.parser_version,checks_passed:Object.keys(parsed.checks).length,
    fields,booking_allowed:false,draft_replaced:false});
});
