import fs from "node:fs";
import assert from "node:assert/strict";
import { roleCapabilities } from "../lib/roles.ts";

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const salesCreators=["director","sales_head","zonal_head","asm","sales_manager","relationship_manager"];
for(const role of salesCreators){assert(roleCapabilities[role].includes("view_policy_intakes"),`${role} must view policy intakes`);assert(roleCapabilities[role].includes("create_policy_intakes"),`${role} must initiate policy intakes`);assert(!roleCapabilities[role].includes("review_policy_intakes"),`${role} must not review policy intakes`);assert(!roleCapabilities[role].includes("finalize_policy_intakes"),`${role} must not finalize policy intakes`);}
for(const role of ["sales_operations_head","backoffice_executive"]){assert(roleCapabilities[role].includes("view_policy_intakes"),`${role} must view policy intakes`);assert(roleCapabilities[role].includes("review_policy_intakes"),`${role} must review policy intakes`);assert(roleCapabilities[role].includes("finalize_policy_intakes"),`${role} must explicitly finalize policy intakes`);}
assert(roleCapabilities.sales_operations_head.includes("create_policies"),"Operations Head needs governed policy-create authority to finalize reviewed intakes");assert(!roleCapabilities.backoffice_executive.includes("create_policy_intakes"),"Backoffice must remain Operations-side, not sales submitter");
for(const role of ["claims_head","claim_processor","field_executive"])assert(!roleCapabilities[role].includes("view_policy_intakes"),`${role} must not inherit policy intake access`);

const actions=read("app/policy-intakes/actions.ts");
assert(actions.includes('canAccessIntermediary(profile.id, profile.role, leadSourceId, "view_intermediaries")'),"Submission must re-check lead-source scope server-side");
assert(actions.includes('createSignedUploadUrl(storagePath,{upsert:false})'),"Large policy files must use direct signed storage upload instead of a Server Action request body");
assert(actions.includes('.from("policy_intake_requests").insert('),"Submission must write the separate intake artefact");
assert(!/from\(["']policies["']\)\s*\.insert\(/.test(actions),"Sales intake submission must never insert a real policy");
assert(actions.includes('input.storagePath.startsWith(`intakes/${input.id}/`)'),"Finalization must validate the signed-upload storage prefix");
assert(actions.includes('createSignedUrl(data.storage_path,300)'),"Policy-copy access must use a short-lived signed URL");
assert(actions.includes('requirePolicyIntakeFinalizer()'),"Closing an intake must require explicit Finalize authority");
assert(actions.includes('preparePolicyIntakeResponseUpload'),"Initiators must be able to respond when Operations requests another document");

const intakeForm=read("components/policy-intake-form.tsx");
assert(intakeForm.includes('fetch(signedUrl,{method:"PUT"'),"Browser must upload policy bytes directly to signed private storage");
assert(intakeForm.includes("Upload couldn't be completed"),"Upload failures must stay on the form with a recoverable error");
const detail=read("app/policy-intakes/[id]/page.tsx");
assert(detail.includes("PolicyIntakeResponseUpload"),"Needs-attention intake must expose the response uploader to its initiator");
assert(detail.includes('hasEffectiveCapability(profile,"finalize_policy_intakes","approve")'),"Detail page must distinguish Review from Finalize authority");

const handoff=read("app/policy-intakes/handoff-actions.ts");assert(handoff.includes("buildPolicyOcrOnboardingUpdate"),"Operations handoff must reuse the governed OCR onboarding mapper");assert(handoff.includes('cpaOpted:"No"'),"OCR liability amount must not silently opt owner-driver CPA in");
const migration=read("../../supabase/migrations/202608240001_policy_intake_workflow.sql");assert(migration.includes("create table if not exists public.policy_intake_requests"),"Intake table migration missing");assert(migration.includes("enable row level security"),"Intake table must enable RLS");assert(migration.includes("revoke all on public.policy_intake_requests from anon, authenticated"),"Browser roles must not receive direct intake-table access");
const permissions=read("lib/permission-management.ts");assert(permissions.includes('label:"Initiate policy intake"'),"Permission UI must use Initiate terminology");assert(permissions.includes('label:"Review policy intake"'),"Permission UI must use Review terminology");assert(permissions.includes('label:"Finalize policy intake"'),"Permission UI must expose separate Finalize authority");
const navigation=read("components/claim-manager/app-navigation.tsx");assert(navigation.includes('key:"policy-intakes"'),"Fleet navigation must contain a Policy Intakes group");assert(navigation.includes('href:"/policy-intakes/new"'),"Sales intake creation link missing");
console.log("policy intake workflow regression: ok");
