import { useLocalSearchParams } from 'expo-router';

import InternalClaimStageLegacy from '@/components/internal-claim-stage-legacy';
import InternalClaimStageParity from '@/components/internal-claim-stage-parity';

export default function InternalClaimStageScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const stageKey = typeof params.key === 'string' ? params.key : '';

  if (stageKey === 'spot_intimation' || stageKey === 'spot_status') {
    return <InternalClaimStageLegacy />;
  }

  return <InternalClaimStageParity />;
}
