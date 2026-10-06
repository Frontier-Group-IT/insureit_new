import { supabase } from '@/lib/supabase';

export const PARTNER_PROFILE_PHOTO_BUCKET = 'partner-profile-photos';

export function partnerProfilePhotoPath(authUserId: string) {
  return `${authUserId}/profile-photo`;
}

export async function getPartnerProfilePhotoUrl(authUserId: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(PARTNER_PROFILE_PHOTO_BUCKET)
    .createSignedUrl(partnerProfilePhotoPath(authUserId), expiresIn);

  if (error) {
    // A missing photo is a valid state; callers should fall back to initials.
    return null;
  }

  return data?.signedUrl ?? null;
}
