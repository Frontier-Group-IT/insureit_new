/**
 * Read-only, operator-verified Customer Firebase enrollment preview.
 * Handler is source-only and DISABLED unless the deploying operator supplies
 * an explicit server-controlled flag. No public-client approval flags.
 *
 * Real authorization is performed by prepareReviewedCustomerEnrollment:
 * signed operator Supabase session + active IT Super User, revocation-checked
 * Firebase token + exact existing Customer UUID, freshest approved journal,
 * phone collision review and existing Auth alias.
 *
 * Never returns raw Customer UUID, Firebase UID, phone, SMS, user row, or token.
 */
import {prepareReviewedCustomerEnrollment} from './customer-firebase-reviewed-enrollment.mjs';

const deny=(status,stage)=>Object.freeze({
  status,body:Object.freeze({ok:false,stage}),
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY=18000;

async function limitedJson(req){
  const reader=req.body?.getReader?.();
  if(!reader)return null;
  const chunks=[];
  let size=0;
  try {
    while(true){
      const part=await reader.read();
      if(part.done)break;
      size+=part.value.length;
      if(size>MAX_BODY)return null;
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
    const obj=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:null;
  }catch{return null;}finally{reader.releaseLock();}
}

/**
 * Response is coarse and never claims that live enrollment occurred.
 * Explicit JS param contract keeps Deno's TS checker from losing untyped
 * fields in destructured defaulted parameters.
 * @param {{
 *   request?: Request,
 *   db?: any,
 *   firebaseAdmin?: any,
 *   nowSeconds?: number,
 *   featureEnabled?: boolean,
 *   review?: typeof prepareReviewedCustomerEnrollment
 * }} [options]
 */
export async function handleCustomerFirebaseOperatorPreview({
  request,db,firebaseAdmin,nowSeconds,featureEnabled=false,
  review=prepareReviewedCustomerEnrollment,
}={}) {
  if(request?.method!=='POST')return deny(405,'method_not_allowed');
  if(featureEnabled!==true)return deny(503,'operator_preview_disabled');
  if(!Number.isSafeInteger(nowSeconds))return deny(503,'server_clock_unavailable');
  const contentType=request.headers?.get?.('content-type')??'';
  if(!/^application\/json(?:\s*;|$)/i.test(contentType))return deny(415,'json_required');
  const bearer=/^Bearer (\S+)$/.exec(request.headers?.get?.('authorization')??'');
  if(!bearer||bearer[1].length<100||bearer[1].length>16384){
    return deny(401,'operator_auth_required');
  }
  const data=await limitedJson(request);
  if(!data || Object.keys(data).sort().join('|')!=='customer_profile_id|firebase_id_token' ||
    !UUID.test(data.customer_profile_id??'') ||
    typeof data.firebase_id_token!=='string' ||
    data.firebase_id_token.length<100 || data.firebase_id_token.length>16384){
    return deny(400,'invalid_request');
  }
  if(!db || !firebaseAdmin)return deny(503,'trusted_services_unavailable');
  try{
    const outcome=await review({
      db,firebaseAdmin,nowSeconds,
      targetCustomerUuid:data.customer_profile_id,
      customerFirebaseIdToken:data.firebase_id_token,
      operatorSupabaseAccessToken:bearer[1],
    });
    if(outcome?.ok===true && outcome.sameExistingUuid===true &&
       outcome.writesPerformed===0){
      if(outcome.stage==='ready_for_explicit_limited_cohort'){
        return Object.freeze({status:200,body:Object.freeze({
          ok:true,stage:'reviewed_existing_session_manual_test_candidate',
          writesPerformed:0,
        })});
      }
      if(outcome.stage==='operator_approved_atomic_uid_enrollment_pending'){
        return Object.freeze({status:200,body:Object.freeze({
          ok:true,stage:'approved_link_write_still_pending',
          writesPerformed:0,
        })});
      }
      if(outcome.stage==='approved_enrollment_requires_auth_recovery'){
        return deny(409,'protected_auth_recovery_required');
      }
    }
    // Do not expose detailed ownership, staff collisions or review status
    // to callers. Operator reviews may use a separate audited internal tool.
    return deny(403,'identity_or_review_not_eligible');
  }catch{return deny(503,'operator_preview_unavailable');}
}
