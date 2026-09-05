import { useLocalSearchParams } from 'expo-router';

import InternalClaimStageOneTracker from '@/components/internal-claim-stage-one-tracker';
import InternalClaimStageLegacyMain from './internal-claim-stage-legacy-main';

export default function InternalClaimStageScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const stageKey = typeof params.key === 'string' ? params.key : '';

  if (stageKey === 'spot_intimation') {
    return <InternalClaimStageOneTracker />;
  }

  return <InternalClaimStageLegacyMain />;
}
