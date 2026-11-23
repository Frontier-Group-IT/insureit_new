import { supabase } from '@/lib/supabase';

const configuredBase = (process.env.EXPO_PUBLIC_AI_STUDIO_API_URL || '').trim();
export const aiStudioActionsEnabled =
  process.env.EXPO_PUBLIC_AI_STUDIO_ACTIONS_ENABLED === 'true' && Boolean(configuredBase);

export type StudioAction = 'reparse' | 'convert';
export type StudioActionResult =
  | {ok:true;action:StudioAction;policy_booked:boolean;draft_replaced?:boolean;policy_id?:string|null;policy_code?:string|null}
  | {ok:false;error:string;issues?:Array<{field:string;message:string}>};

function verifiedBackendOrigin():string {
  if(!aiStudioActionsEnabled)throw new Error('The secure Studio service is not yet enabled.');
  let url:URL;
  try{url=new URL(configuredBase);}catch{throw new Error('Invalid secure Studio service address.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'
    ||!(url.hostname==='studio.nishant.uk'||url.hostname==='api.insureit.in'||url.hostname.endsWith('.workers.dev'))){
    throw new Error('The Studio service has not been configured with a trusted HTTPS origin.');
  }
  return url.origin;
}

/**
 * One explicit operator action. No policies, OCR values, source URLs or
 * customer decisions are sent from the device. The backend independently
 * re-verifies the current PDF and runs canonical booking transactions.
 * Do not automatically retry a failed/unknown conversion.
 */
export async function performAiStudioAction(intakeId:string,action:StudioAction):Promise<StudioActionResult> {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(intakeId)){
    throw new Error('Invalid intake reference.');
  }
  const origin=verifiedBackendOrigin();
  const {data:auth,error:sessionError}=await supabase.auth.getSession();
  if(sessionError||!auth.session?.access_token)throw new Error('Sign in again before making changes.');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),90_000);
  try {
    const response=await fetch(origin+'/api/partner/ai-policy-studio/actions',{
      method:'POST',cache:'no-store',signal:controller.signal,
      headers:{'content-type':'application/json','authorization':'Bearer '+auth.session.access_token},
      body:JSON.stringify({intake_id:intakeId,action,confirm:true}),
    });
    const payload:unknown=await response.json();
    if(!payload||typeof payload!=='object'||Array.isArray(payload))
      throw new Error('The secure Studio service returned an invalid result.');
    const result=payload as Record<string,unknown>;
    if(response.ok&&result.ok===true){
      return {ok:true,action,policy_booked:result.policy_booked===true,
        draft_replaced:result.draft_replaced===true,
        policy_id:typeof result.policy_id==='string'?result.policy_id:null,
        policy_code:typeof result.policy_code==='string'?result.policy_code:null};
    }
    return {ok:false,error:typeof result.error==='string'?result.error:'The action was not accepted.',
      issues:Array.isArray(result.issues)?result.issues.filter((v):v is {field:string;message:string}=>
        Boolean(v&&typeof v==='object'&&typeof v.field==='string'&&typeof v.message==='string')).slice(0,5):[]};
  }catch{
    // Every transport/JSON/timeout failure may have happened after the server
    // committed the policy. Do not let operators blindly repeat the action.
    throw new Error('The result is unknown. Refresh this intake before doing anything else.');
  }finally{clearTimeout(timeout);}
}
