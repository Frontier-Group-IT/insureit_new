import {cert,getApps,initializeApp} from "npm:firebase-admin@13.5.0/app";
import {getAuth} from "npm:firebase-admin@13.5.0/auth";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {handleCustomerFirebaseOperatorPreview}
  from "../_shared/customer-firebase-operator-preview.mjs";

/**
 * SOURCE-ONLY operator preview. NOT DEPLOYED and default-disabled.
 *
 * The gateway should verify the SUPABASE IT operator bearer JWT (verify_jwt
 * must NOT be disabled). An independently signed Firebase ID token is sent
 * in the bounded JSON body and checked with Admin verifyIdToken(token,true).
 *
 * Deliberately no CORS, no raw-token logging, no Auth modifications, no
 * Firebase UID approvals, and no public candidate inventory.
 */
const response=(status:number,body:Record<string,unknown>)=>
  new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store, private",
      "pragma":"no-cache",
      "x-content-type-options":"nosniff",
    },
  });

function firebaseVerifier(){
  const raw=Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if(!raw)throw new Error("Firebase verifier unavailable");
  const credentials=JSON.parse(raw);
  if(credentials.project_id!=="insureit-customer-auth"||
      !credentials.client_email||!credentials.private_key){
    throw new Error("Firebase verifier mismatch");
  }
  const name="insureit-firebase-operator-preview";
  const app=getApps().find(a=>a.name===name)??
    initializeApp({credential:cert(credentials),projectId:"insureit-customer-auth"},name);
  return getAuth(app);
}
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST")return response(405,{ok:false,stage:"method_not_allowed"});
  // Critical: server-controlled flag is never supplied by request JSON.
  if(Deno.env.get("CUSTOMER_FIREBASE_OPERATOR_PREVIEW_ENABLED")!=="true"){
    return response(503,{ok:false,stage:"operator_preview_disabled"});
  }
  try{
    const url=Deno.env.get("SUPABASE_URL");
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!service)throw new Error("Database unavailable");
    const db=createClient(url,service,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const result=await handleCustomerFirebaseOperatorPreview({
      request,db,firebaseAdmin:firebaseVerifier(),
      nowSeconds:Math.floor(Date.now()/1000),
      featureEnabled:true,
    });
    return response(result.status,result.body);
  }catch{
    return response(503,{ok:false,stage:"operator_preview_unavailable"});
  }
});
