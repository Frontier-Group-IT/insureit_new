/**
 * Trusted server-only lookup for an approved Firebase UID -> canonical profile.
 * This is injected into the Admin verifier, not used by the mobile client.
 * The Supabase client MUST be server privileged; never export its key to Expo.
 */
import type { IdentityLink, IdentityLinkStore } from './server-identity-binding';

const PROJECT = 'insureit-customer-auth';
type DatabaseRow = {
  firebase_uid: string;
  profile_id: string;
  verified_phone_at_approval: string;
  is_approved: boolean;
  is_active: boolean;
  profiles: { role: string; is_active: boolean } | null;
};
export type PrivilegedIdentityClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{
          data: unknown;
          error: unknown;
        }>;
      };
    };
  };
};

export function createCustomerFirebaseIdentityStore(client: PrivilegedIdentityClient): IdentityLinkStore {
  return async (firebaseUid) => {
    if (typeof firebaseUid !== 'string' || !firebaseUid || firebaseUid.length > 128) {
      throw new Error('Invalid Firebase UID');
    }
    const { data, error } = await client
      .from('customer_firebase_identity_links')
      .select('firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active,profiles!customer_firebase_identity_links_profile_id_fkey(role,is_active)')
      .eq('firebase_project_id', PROJECT)
      .eq('firebase_uid', firebaseUid);
    if (error || !Array.isArray(data)) throw new Error('Identity lookup unavailable');
    return data.map((value) => {
      const row = value as DatabaseRow;
      if (!row || typeof row.firebase_uid !== 'string' || typeof row.profile_id !== 'string' ||
          typeof row.verified_phone_at_approval !== 'string' || typeof row.is_approved !== 'boolean' ||
          typeof row.is_active !== 'boolean' || !row.profiles ||
          typeof row.profiles.role !== 'string' || typeof row.profiles.is_active !== 'boolean') {
        throw new Error('Malformed identity lookup result');
      }
      return {
        firebaseUid: row.firebase_uid,
        profileId: row.profile_id,
        verifiedPhoneAtApproval: row.verified_phone_at_approval,
        approved: row.is_approved,
        active: row.is_active,
        profileRole: row.profiles.role,
        profileActive: row.profiles.is_active,
      } satisfies IdentityLink;
    });
  };
}
