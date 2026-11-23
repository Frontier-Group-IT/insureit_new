import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Set ONLY after the Partner API handler verifies the user JWT and the
// per-intake IT-operator authorization against Supabase. Request scoped;
// no global mutable token, no client-controlled impersonation header.
const verifiedPartnerToken = new AsyncLocalStorage<{token:string}>();

export function withVerifiedPartnerApiToken<T>(
  token:string,
  operation:()=>Promise<T>,
):Promise<T> {
  if(!token||token.length>8192)throw new Error("partner_auth_invalid");
  return verifiedPartnerToken.run({token},operation);
}

export function getVerifiedPartnerApiToken():string|undefined {
  return verifiedPartnerToken.getStore()?.token;
}
