/** Server-enforced phase-2 Customer-only rollout. Staff and all other users denied. */
export const CUSTOMER_FIREBASE_CANARY_UUIDS = Object.freeze([
  '9106ffc7-299c-404d-aa84-868707e8d586',
  '6c04b126-36ea-4c5a-bd28-e8649bae895f',
]);
export function checkCustomerFirebaseCanary({profile,authUser,link,phone}) {
  const id = profile?.id;
  if (!CUSTOMER_FIREBASE_CANARY_UUIDS.includes(id) || authUser?.id !== id ||
      link?.profile_id !== id || profile?.role !== 'customer' ||
      profile?.is_active !== true || typeof phone !== 'string') {
    return {ok:false,reason:'outside_approved_canary'};
  }
  return {ok:true};
}
