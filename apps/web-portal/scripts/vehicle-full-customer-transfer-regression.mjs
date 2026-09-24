import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label} missing: ${expected}`);
}

const migration = read("../../supabase/migrations/20260924163000_vehicle_full_customer_transfer.sql");
const action = read("app/vehicles/[id]/transfer/actions.ts");
const page = read("app/vehicles/[id]/transfer/page.tsx");
const form = read("app/vehicles/[id]/transfer/transfer-vehicle-form.tsx");
const detail = read("app/vehicles/[id]/page.tsx");

for (const expected of [
  "transfer_vehicle_customer_v1",
  "vehicle_ownership_history",
  "update public.policies",
  "update public.external_policies",
  "update public.claims",
  "update public.claim_documents",
  "update public.customer_documents",
  "update public.intermediary_commission_ledger",
  "update public.intermediary_referrals",
  "update public.service_enquiries",
  "vehicle_customer_transferred",
  "grant execute on function public.transfer_vehicle_customer_v1",
]) {
  assertIncludes(migration, expected, "transfer migration");
}

for (const expected of [
  'TRANSFER_ROLES = new Set(["manager", "admin", "super_admin", "it_super_user"])',
  'formData.get("confirm_everything") === "on"',
  'admin.rpc("transfer_vehicle_customer_v1"',
  'getAccessibleCustomerIds',
]) {
  assertIncludes(action, expected, "transfer server action");
}

assertIncludes(page, "INSUREIT does not allow a vehicle-only transfer", "transfer warning");
assertIncludes(form, "Transfer vehicle and all dependencies", "transfer confirmation");
assertIncludes(form, 'name="confirm_everything"', "transfer confirmation checkbox");
assertIncludes(detail, "/transfer", "vehicle detail transfer link");

console.log("vehicle full customer transfer regression passed");
