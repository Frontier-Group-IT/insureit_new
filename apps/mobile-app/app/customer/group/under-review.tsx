import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GroupHomeScreen } from '@/components/group/group-home-screen';
import { LoadingState } from '@/components/ui';
import { getOnboardingApplicationForUser, getProfile, isValidProfile } from '@/lib/auth';
import { getCustomerIdentity } from '@/lib/customer-identity';
import type { CustomerOnboardingApplication, Profile } from '@/lib/types';

export default function GroupUnderReviewScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<CustomerOnboardingApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const identity = await getCustomerIdentity();
        if (!identity) return router.replace('/login');
        const [nextProfile, nextApplication] = await Promise.all([
          getProfile(identity.profileId, identity.data),
          getOnboardingApplicationForUser(identity.profileId, false, identity.data),
        ]);
        if (!active) return;
        if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
        if (!nextApplication || nextApplication.partner_type !== 'group') return router.replace('/customer/home');
        if (!['submitted', 'under_review'].includes(nextApplication.status)) return router.replace('/customer/kyc/group');
        setProfile(nextProfile);
        setApplication(nextApplication);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  if (loading || !profile || !application) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' }}><LoadingState label="Opening Group dashboard" /></View>;
  return <GroupHomeScreen profile={profile} onboarding={application} underReview />;
}
