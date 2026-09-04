import type { User } from '@supabase/supabase-js';
import type { Router } from 'expo-router';

import {
  claimPendingCustomerMemberships,
  getCustomerForUser,
  getOnboardingApplicationForUser,
  getProfile,
  isValidProfile,
  resetLocalAuthState,
  routeForRole,
} from './auth';
import { clearSelectedCustomerContext } from './customer-context';
import { logStartupDiagnostic } from './startup-diagnostics';
import { supabase } from './supabase';

const inactiveCustomerMessage = 'This customer account is no longer active. Use Sign Up to register again.';
const unavailableCustomerMessage = 'We could not confirm your customer account right now. Please try again.';

export async function routeRestoredUser(user: User, router: Router) {
  const profile = await getProfile(user.id);
  await logStartupDiagnostic('profile_resolved', { profilePresent: Boolean(profile) });

  if (profile?.role === 'customer' && !profile.is_active) {
    await logStartupDiagnostic('confirmed_inactive_customer', { reason: 'profile_inactive' });
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      await resetLocalAuthState(router);
    }
    throw new Error(inactiveCustomerMessage);
  }

  if (!isValidProfile(profile)) {
    router.replace('/access-denied');
    return profile;
  }

  if (profile.role === 'customer') {
    await clearSelectedCustomerContext();
    await claimPendingCustomerMemberships();

    const [customer, onboarding] = await Promise.all([
      getCustomerForUser(user.id),
      getOnboardingApplicationForUser(user.id),
    ]);

    await logStartupDiagnostic('customer_context_resolved', {
      customerPresent: Boolean(customer),
      onboardingPresent: Boolean(onboarding),
    });

    if (!customer && !onboarding) {
      await logStartupDiagnostic('customer_context_missing', { reason: 'no_customer_or_onboarding' });
      throw new Error(unavailableCustomerMessage);
    }
  }

  router.replace(routeForRole(profile.role));
  return profile;
}
