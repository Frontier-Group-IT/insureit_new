import { ensureCustomerOnboardingForPartner, getOnboardingApplicationForUser, getProfile } from './auth';
import { getCustomerIdentity } from './customer-identity';
import type { PartnerType } from './types';

/**
 * Preserves Supabase user semantics for existing customers, but uses an
 * approved canonical Firebase profile for new customer onboarding.
 * No fabricated Supabase User or Supabase Auth session is ever constructed.
 */
export async function ensureOnboardingForCurrentCustomer(partnerType: PartnerType) {
  const identity = await getCustomerIdentity();
  if (!identity) throw new Error('Please sign in to continue onboarding.');
  if (identity.provider === 'supabase') {
    return ensureCustomerOnboardingForPartner(identity.session.user, partnerType);
  }
  const { profileId, data: client } = identity;
  const existing = await getOnboardingApplicationForUser(profileId, false, client);
  if (existing && ['submitted', 'under_review'].includes(existing.status)) return existing;
  if (existing?.partner_type === partnerType) return existing;

  const profile = await getProfile(profileId, client);
  if (!profile || profile.role !== 'customer' || !profile.is_active) {
    throw new Error('Your customer account is not authorized.');
  }
  if (existing) {
    const { data, error } = await client.from('customer_onboarding_applications')
      .update({
        partner_type: partnerType,
        status: 'in_progress',
        current_step: 1,
        draft_data: {},
      })
      .eq('id', existing.id)
      .eq('profile_id', profileId)
      .select('*').single();
    if (error || !data) throw new Error('Could not update your onboarding application.');
    return data;
  }
  const { data, error } = await client.from('customer_onboarding_applications')
    .insert({
      profile_id: profileId,
      initiated_by: profileId,
      source: 'customer_app',
      status: 'in_progress',
      partner_type: partnerType,
      current_step: 1,
      applicant_phone: profile.phone ?? null,
      applicant_email: profile.email ?? null,
    })
    .select('*').single();
  if (error || !data) throw new Error('Could not create your onboarding application.');
  return data;
}
