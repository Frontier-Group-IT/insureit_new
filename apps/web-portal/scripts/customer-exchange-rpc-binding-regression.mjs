import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loader = readFileSync(new URL("../lib/customer-web-phase3-data.ts", import.meta.url), "utf8");
const functions = [
  "exchange_marketplace_feed",
  "exchange_my_sellable_vehicles",
  "exchange_my_activity",
  "exchange_listing_detail",
];
for (const fn of functions) {
  assert.ok(loader.includes('exchangeClient.rpc("' + fn + '"'), fn + " must retain its Supabase client receiver");
}
assert.doesNotMatch(loader, /const rpc = supabase\.rpc/, "Unbound Supabase method extraction must not return");
assert.equal((loader.match(/const exchangeClient = supabase as unknown as \{ rpc: UntypedRpc \};/g) || []).length, 4);
console.log("Customer Exchange RPC binding regression passed.");
