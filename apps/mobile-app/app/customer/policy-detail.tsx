import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import CustomerLifeHealthPolicyDetailScreen from '@/components/customer-life-health-policy-detail-screen';
import CustomerMotorPolicyDetailScreen from '@/components/customer-motor-policy-detail-screen';
import CustomerPolicyDetailScreen from '@/components/customer-policy-detail-screen';
import { LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';

type DetailKind = 'life-health' | 'motor' | 'legacy';

export default function CustomerPolicyDetailRoute() {
  const router = useRouter();
  const { id, source } = useLocalSearchParams<{ id: string; source?: 'sibl' | 'external' }>();
  const [detailKind, setDetailKind] = useState<DetailKind | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) return;
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const contexts = await getOperationalCustomerContexts();
      const customerIds = contexts.map((context) => context.customer_id);
      if (!customerIds.length) {
        if (active) setDetailKind('legacy');
        return;
      }

      let policyType: string | null = null;
      let policyProduct: string | null = null;
      if (source === 'external') {
        const row = (
          await (supabase as any)
            .from('external_policies')
            .select('policy_type,policy_product')
            .eq('id', id)
            .in('customer_id', customerIds)
            .maybeSingle()
        ).data;
        policyType = row?.policy_type ?? null;
        policyProduct = row?.policy_product ?? null;
      } else {
        const row = (
          await supabase
            .from('policies')
            .select('policy_type,policy_product')
            .eq('id', id)
            .in('customer_id', customerIds)
            .maybeSingle()
        ).data;
        policyType = row?.policy_type ?? null;
        policyProduct = row?.policy_product ?? null;
        if (!policyType) {
          const externalRow = (
            await (supabase as any)
              .from('external_policies')
              .select('policy_type,policy_product')
              .eq('id', id)
              .in('customer_id', customerIds)
              .maybeSingle()
          ).data;
          policyType = externalRow?.policy_type ?? null;
          policyProduct = externalRow?.policy_product ?? null;
        }
      }

      if (!active) return;
      const identity = `${policyType ?? ''} ${policyProduct ?? ''}`.trim();
      if (/\b(life|health)\b/i.test(identity)) {
        setDetailKind('life-health');
      } else if (/\bmotor\b|package|comprehensive|standalone|third.?party|own.?damage/i.test(identity)) {
        setDetailKind('motor');
      } else {
        setDetailKind('legacy');
      }
    })();
    return () => {
      active = false;
    };
  }, [id, router, source]);

  if (detailKind === null) return <Screen title="Policy Detail"><LoadingState /></Screen>;
  if (detailKind === 'life-health') return <CustomerLifeHealthPolicyDetailScreen />;
  if (detailKind === 'motor') return <CustomerMotorPolicyDetailScreen />;
  return <CustomerPolicyDetailScreen />;
}
