import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Only the cron worker enters this per-request context, after it authenticates
// and verifies all existing operator capabilities. Ordinary operator UI
// handoffs continue to explicitly claim human review ownership.
const automaticBooking = new AsyncLocalStorage<boolean>();

export function withAutomaticPolicyBooking<T>(operation:()=>Promise<T>):Promise<T> {
  return automaticBooking.run(true,operation);
}

export function isAutomaticPolicyBooking():boolean {
  return automaticBooking.getStore()===true;
}
