import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import CustomerClaimDetailScreen from '@/components/customer/claim-detail-screen';

export default function ClaimDetailRoute() {
  const [focusVersion, setFocusVersion] = useState(0);

  useFocusEffect(useCallback(() => {
    setFocusVersion((value) => value + 1);
  }, []));

  return <CustomerClaimDetailScreen key={focusVersion} />;
}
