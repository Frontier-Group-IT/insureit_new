import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const bucket='claim-documents';
const allowed: Record<string,string> = {
  rc:'RC Copy',insurance:'Insurance Copy',licence:'Driver Licence',gr_load:'GR / Load Bill',
  accident_photo:'Accident Photo',accident_video:'Accident Video',voice_note:'Incident Voice Note',additional_document:'Additional Document',
};
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
    const bearer=request.headers.get('authorization')||'';
    const token=bearer.replace(/^Bearer\s+/i,'');
    if(!token)return reply({error:'Authentication required'},401);
    const url=Deno.env.get('SUPABASE_URL')!;
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const {data:userData,error:userError}=await userDb.auth.getUser(token);
    if(userError||!userData.user)return reply({error:'Authentication required'},401);
    const body=await request.json();
    const claimId=String(body.claim_id||'');
    const kind=String(body.kind||'');
    const action=String(body.action||'');
    if(!/^[a-f0-9-]{36}$/i.test(claimId)||!allowed[kind])return reply({error:'Invalid claim or document category'},400);
    const {data:scope,error:scopeError}=await userDb.rpc('partner_app_claim_in_scope',{p_claim_id:claimId});
    if(scopeError||scope!==true)return reply({error:'Claim not authorized for this Partner'},403);
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const {data:claim,error:claimError}=await admin.from('claims').select('id,customer_id,current_status').eq('id',claimId).single();
    if(claimError||!claim)return reply({error:'Claim unavailable'},404);
    if(['Settled','Closed','Claim Complete','Rejected'].includes(claim.current_status))return reply({error:'Claim is closed'},409);
    const name=String(body.name||'').slice(0,150);
    const mime=String(body.mime||'').toLowerCase();
    const size=Number(body.size);
    const video=kind==='accident_video';
    const audio=kind==='voice_note';
    const supported=video?['video/mp4','video/quicktime','video/webm']:audio?['audio/m4a','audio/mp4','audio/x-m4a']:['application/pdf','image/jpeg','image/png','image/webp'];
    const max=video?50*1024*1024:audio?10*1024*1024:5*1024*1024;
    if(!supported.includes(mime)||!Number.isFinite(size)||size<=0||size>max||!name)return reply({error:'Unsupported file type or size'},400);
    if(action==='prepare'){
      const cleaned=name.replace(/[^A-Za-z0-9._-]/g,'_');
      const path=`${claim.customer_id}/${claimId}/partner/${crypto.randomUUID()}-${cleaned}`;
      const {data,error}=await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});
      if(error||!data)return reply({error:'Could not prepare authorized upload'},500);
      return reply({path,token:data.token});
    }
    if(action==='finalize'){
      const path=String(body.path||'');
      if(!path.startsWith(`${claim.customer_id}/${claimId}/partner/`)||path.includes('..'))return reply({error:'Invalid file path'},400);
      const objectName=path.split('/').pop()||'';
      const folder=path.slice(0,path.lastIndexOf('/'));
      const {data:objects,error:objectError}=await admin.storage.from(bucket).list(folder,{search:objectName,limit:100});
      const object=objects?.find(item=>item.name===objectName);
      if(objectError||!object)return reply({error:'Upload is not yet present'},409);
      const actualSize=Number((object.metadata as Record<string,unknown>|null)?.size||0);
      if(!actualSize||actualSize>max)return reply({error:'Uploaded file exceeds allowed size'},400);
      const {data:existing}=await admin.from('claim_documents').select('id').eq('claim_id',claimId).eq('storage_path',path).maybeSingle();
      if(existing?.id)return reply({document_id:existing.id});
      const {data:inserted,error:insertError}=await admin.from('claim_documents').insert({
        claim_id:claimId,customer_id:claim.customer_id,document_type:kind,file_name:name,
        storage_bucket:bucket,storage_path:path,mime_type:mime,file_size:actualSize,uploaded_by:userData.user.id,
        verification_required:true,
      }).select('id').single();
      if(insertError||!inserted)return reply({error:'File uploaded but document record could not be finalized'},500);
      return reply({document_id:inserted.id});
    }
    return reply({error:'Invalid upload action'},400);
  }catch{ return reply({error:'Request could not be completed'},500); }
});
