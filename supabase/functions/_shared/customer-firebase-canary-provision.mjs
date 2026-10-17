import { customerAuthAlias, isApprovedAuthAlias } from './customer-firebase-session-alias.mjs';
import { checkCustomerFirebaseCanary } from './customer-firebase-canary-gate.mjs';

/**
 * Only the two disposable, owner-authorized Customer Auth UUIDs.
 * This operation can invalidate the old Customer password; no staff record is
 * modified. Call only after Admin Firebase signature/revocation verification,
 * approved immutable UID linkage. The bridge consumes the one-use SMS event
 * only after the same-UUID Auth identity is ready, before issuing a challenge.
 */
export async function provisionDisposableFirebaseCanaryAlias({
 db, profile, authUser, link, verifiedPhone, explicitCanaryApproval
}) {
 const deny = reason => ({ok:false,reason});
 if (explicitCanaryApproval !== true || !checkCustomerFirebaseCanary({
   profile,authUser,link,phone:verifiedPhone
 }).ok) return deny('not_approved_canary');
 const id=profile.id,alias=customerAuthAlias(id);
 if (!alias || !authUser || authUser.id !== id) return deny('invalid_auth_identity');
 if (isApprovedAuthAlias(id,authUser.email) && authUser.email_confirmed_at)
   return {ok:true,authUser};
 if (authUser.email || authUser.email_confirmed_at) return deny('existing_email_cannot_be_overwritten');
 if (!db?.auth?.admin?.updateUserById || !db?.auth?.admin?.getUserById)
   return deny('auth_admin_unavailable');
 // Random, unshared password prevents the original phone-password credential
 // from becoming a deterministic email-password credential.
 const credential=Array.from(crypto.getRandomValues(new Uint8Array(32)),
   byte=>byte.toString(16).padStart(2,'0')).join('');
 const update=await db.auth.admin.updateUserById(id,{
   email:alias,email_confirm:true,password:credential,
 });
 if(update.error || update.data?.user?.id !== id) return deny('auth_update_failed');
 const verify=await db.auth.admin.getUserById(id);
 const current=verify.data?.user;
 if (verify.error || !current || current.id!==id ||
   !isApprovedAuthAlias(id,current.email) || !current.email_confirmed_at ||
   current.phone!==authUser.phone ||
   (current.phone_confirmed_at??null)!==(authUser.phone_confirmed_at??null))
   return deny('post_write_identity_mismatch');
 return {ok:true,authUser:current};
}
