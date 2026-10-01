import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import CustomerLifeHealthPolicyDetailScreen from '@/components/customer-life-health-policy-detail-screen';
import CustomerPolicyDetailScreen from '@/components/customer-policy-detail-screen';
import { LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';

export default function CustomerPolicyDetailRoute() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [lifeHealth, setLifeHealth] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const customerIds = contexts.map((context) => context.customer_id);
      if (!customerIds.length) {
        if (active) setLifeHealth(false);
        return;
      }

      let policyType: string | null = null;
      if (source === 'external') {
        policyType = (
          await (supabase as any)
            .from('external_policies')
            .select('policy_type')
            .eq('id', id)
            .in('customer_id', customerIds)
            .maybeSingle()
        ).data?.policy_type ?? null;
      } else {
        policyType = (
          await supabase
            .from('policies')
            .select('policy_type')
            .eq('id', id)
            .in('customer_id', customerIds)
            .maybeSingle()
        ).data?.policy_type ?? null;
        if (!policyType) {
          policyType = (
            await (supabase as any)
              .from('external_policies')
              .select('policy_type')
              .eq('id', id)
              .in('customer_id', customerIds)
              .maybeSingle()
          ).data?.policy_type ?? null;
        }
      }
      if (active) setLifeHealth(/\b(life|health)\b/i.test(policyType?.trim() ?? ''));
    })();
    return () => {
      active = false;
    };
  }, [id, router, source]);

  if (lifeHealth === null) return <Screen title="Policy Detail"><LoadingState /></Screen>;
  return lifeHealth ? <CustomerLifeHealthPolicyDetailScreen /> : <CustomerPolicyDetailScreen />;
}
