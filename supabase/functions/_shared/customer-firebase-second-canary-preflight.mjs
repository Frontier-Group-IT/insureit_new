/**
 * Non-mutating second-canary candidate PRECHECK, not authentication or approval.
 * Never expose Customer/Auth identifiers or phone inventory in summaries.
 * Required inventories come from a trusted operator/service process; never
 * accept an untrusted client's claim that a phone or Firebase UID is unique.
 */
import { classifyCustomerFirebaseReadiness } from './customer-firebase-general-rollout-plan.mjs';
import { canonicalIndianPhone } from './customer-firebase-session-policy.mjs';

const verdict=(stage,flags=[])=>Object.freeze({
  stage, flags:Object.freeze([...new Set(flags)].sort()),
  permitsEnrollment:false, permitsDataAccess:false, writesPerformed:0,
});

/**
 * The older rollout planner checks duplicate profile phone ownership.
 * This additional precheck verifies separate Auth users and Firebase UID
 * collisions, including Auth identities without linked public profiles.
 * All inventories must be complete, privileged read-only results.
 */
export function classifySecondCustomerCanary({
  profile,authUser,links,relatedProfiles,relatedAuthUsers,allFirebaseLinks,
  nowSeconds,
}={}) {
  const existing=classifyCustomerFirebaseReadiness({
    profile,authUser,links,relatedProfiles,nowSeconds,
  });
  if (!Array.isArray(relatedAuthUsers)) {
    return verdict('auth_phone_inventory_unavailable',existing.flags);
  }
  if (!Array.isArray(allFirebaseLinks)) {
    return verdict('cross_customer_uid_inventory_unavailable',existing.flags);
  }
  const phone=canonicalIndianPhone(profile?.phone);
  if (!phone || !authUser || authUser.id!==profile?.id) {
    return verdict(existing.stage,existing.flags);
  }
  const sameAuth=relatedAuthUsers.filter(u=>
    u && u.id!==profile.id && canonicalIndianPhone(u.phone)===phone);
  if (sameAuth.length) {
    return verdict('shared_auth_phone_review_required',[
      ...existing.flags,'shared_with_other_auth_principal',
    ]);
  }
  const approvedLink=Array.isArray(links) && links.length===1 ? links[0] : null;
  if (approvedLink && typeof approvedLink.firebase_uid==='string' &&
      allFirebaseLinks.some(link=>link &&
        link.firebase_uid===approvedLink.firebase_uid &&
        link.firebase_project_id===approvedLink.firebase_project_id &&
        link.profile_id!==profile.id)) {
    return verdict('firebase_uid_conflict',existing.flags);
  }
  if (existing.stage!=='ready_existing_session') {
    return verdict(existing.stage,existing.flags);
  }
  // Even this state does not authorize a real Customer login: it is only
  // a precheck for independently consented, approved test accounts.
  return verdict('preflight_passed_manual_owner_consent_and_live_test_required',
    existing.flags);
}

/** No identifiers, phone suffixes, links, or Auth fields in summary. */
export function summarizeSecondCustomerCanaryPreflight(items) {
  if (!Array.isArray(items)) return Object.freeze({ok:false,reason:'inventory_unavailable'});
  const stages={};
  const seen=new Set();
  for(const item of items) {
    if(!item?.profile?.id || seen.has(item.profile.id)) {
      return Object.freeze({ok:false,reason:'duplicate_or_missing_profile'});
    }
    seen.add(item.profile.id);
    const decision=classifySecondCustomerCanary(item);
    stages[decision.stage]=(stages[decision.stage]??0)+1;
  }
  return Object.freeze({ok:true,analyzed:items.length,stages:Object.freeze(stages),
    canaryEnrollmentsPerformed:0,authWritesPerformed:0});
}
