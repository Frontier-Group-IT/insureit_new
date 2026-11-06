import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/customer/claim-documents/[id]/open/route.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../lib/auth-server.ts", import.meta.url), "utf8");

assert.match(route, /import \{ createCustomerServerSupabaseClient \} from "@\/lib\/auth-server"/);
assert.match(route, /const db=await createCustomerServerSupabaseClient\(\)/);
assert.doesNotMatch(route, /\bcreateServerSupabaseClient\b/);
assert.match(auth, /createCustomerServerSupabaseClient\(\)[\s\S]*?getCustomerServerAccessToken\(\)/);
assert.match(route, /resolveCustomerWebScope\(query\.get\("account"\)\)/);
assert.match(route, /loadCustomerClaimDetail\(account\.id,claimId\)/);
assert.match(route, /\.eq\("id",id\)\.eq\("claim_id",claim\.id\)\.eq\("customer_id",account\.id\)/);
assert.match(route, /createSignedUrl\(document\.storage_path,60\)/);
assert.match(route, /NextResponse\.redirect\(signed\.signedUrl\)/);
assert.match(route, /error:"Document unavailable"/);
assert.match(route, /error:"Document could not be opened"/);

console.log("Customer claim document open session and ownership regression passed.");
