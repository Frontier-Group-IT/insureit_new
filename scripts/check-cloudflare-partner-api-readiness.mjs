// Read-only Cloudflare provenance probe for a potential independent Next.js
// API fallback. Never sends auth headers, secrets, cookies, or user data.
// Informational only: a responding Worker does NOT prove database bindings,
// route parity, ownership, or authorization.
const base="https://insureit-new.shahdolho.workers.dev";
const targets=[
  ["/login",new Set([200,301,302,303,307,308])],
  ["/api/partner/policy-intakes",new Set([401,403])],
  ["/api/partner/policy-intakes/native-onboarding",new Set([405])],
  ["/api/partner/customers/create",new Set([405])],
  ["/api/partner/life-health-cases",new Set([401,403])],
];
const rows=[];
for(const [path,expected] of targets){
  try{
    const response=await fetch(base+path,{
      method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000),
      headers:{"Accept":"text/html, application/json","User-Agent":"INSUREIT-non-authenticated-CI-readiness-probe"}
    });
    rows.push({path,status:response.status,expected:expected.has(response.status)});
  }catch(error){
    rows.push({path,status:null,expected:false,error:error instanceof Error?error.name:"network"});
  }
}
const probable=rows.every(row=>row.expected);
console.log(JSON.stringify({target:base,probable_public_route_presence:probable,results:rows},null,2));
console.log("No production credentials were used. Status only; not readiness certification.");
