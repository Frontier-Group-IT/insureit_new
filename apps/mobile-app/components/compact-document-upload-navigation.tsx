import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_MANAGED_MILESTONES, type ClaimMilestone } from '@/lib/claim-service-mode';
import { palette } from '@/lib/theme';

type HeaderProps = {
  step: number;
  title: string;
  subtitle?: string;
  vehicleNo?: string | null;
  claimNo?: string | null;
};

type ActionProps = {
  claimId: string;
  step: number;
  milestones: ClaimMilestone[];
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
};

const stageIcons: Array<keyof typeof MaterialCommunityIcons.glyphMap> = [
  'car-emergency',
  'clipboard-check-outline',
  'car-wrench',
  'clipboard-check-multiple-outline',
  'tools',
  'receipt-text-outline',
  'clipboard-plus-outline',
  'truck-check-outline',
  'cash-check',
];

export function CompactDocumentStageHeader({ step, title, subtitle, vehicleNo, claimNo }: HeaderProps) {
  const icon = stageIcons[Math.max(0, Math.min(stageIcons.length - 1, step - 1))];
  return (
    <View style={styles.headerWrap}>
      <View style={styles.stageHero}>
        <View style={styles.stageIcon}>
          <View style={styles.stageIconGlow} />
          <MaterialCommunityIcons name={icon} size={35} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>STEP {step} OF 9</Text>
          <Text style={styles.title}>{title}</Text>
          {vehicleNo || claimNo ? <Text style={styles.identity}>{[vehicleNo, claimNo].filter(Boolean).join('  •  ')}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.selfTrackedBadge}><Text style={styles.selfTrackedText}>Self Tracked</Text></View>
      </View>
    </View>
  );
}

export function CompactDocumentActionBar({ claimId, step, milestones, primaryLabel, primaryDisabled, onPrimary }: ActionProps) {
  const router = useRouter();
  const currentIndex = Math.max(0, Math.min(SELF_MANAGED_MILESTONES.length - 1, step - 1));
  const previousEnabled = Boolean(claimId) && currentIndex > 0;
  const completedKeys = new Set(
    milestones
      .filter((item) => item.milestone_status === 'completed' || item.milestone_status === 'not_applicable')
      .map((item) => item.milestone_key),
  );

  function openPrevious() {
    if (!previousEnabled) return;
    const stage = SELF_MANAGED_MILESTONES[currentIndex - 1];
    if (!stage) return;
    if (stage.key === 'spot_intimation') {
      router.push({ pathname: '/customer/self-managed-claim', params: { id: claimId } });
      return;
    }
    if (stage.key === 'spot_status') {
      router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claimId } });
      return;
    }
    router.push({ pathname: '/customer/self-managed-milestone', params: { id: claimId, key: stage.key } });
  }

  return (
    <View style={styles.actionSection}>
      <View style={styles.dots} accessibilityLabel={`Claim stage ${step} of ${SELF_MANAGED_MILESTONES.length}`}>
        {SELF_MANAGED_MILESTONES.map((stage, index) => {
          const completed = completedKeys.has(stage.key);
          const current = index === currentIndex;
          return <View key={stage.key} style={[styles.dot, completed && styles.dotCompleted, current && styles.dotCurrent]} />;
        })}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous claim stage"
          accessibilityState={{ disabled: !previousEnabled }}
          disabled={!previousEnabled}
          onPress={openPrevious}
          style={[styles.previousButton, !previousEnabled && styles.buttonDisabled]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={previousEnabled ? '#0A43A3' : '#AEB9C8'} />
          <Text style={[styles.previousText, !previousEnabled && styles.disabledText]}>Previous</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(primaryDisabled) }}
          disabled={primaryDisabled}
          onPress={onPrimary}
          style={[styles.primaryButton, primaryDisabled && styles.buttonDisabled]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
          <MaterialCommunityIcons name="arrow-right" size={21} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 14 },
  stageHero: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 2, minHeight: 90 },
  stageIcon: { position: 'relative', width: 72, height: 72, borderRadius: 21, backgroundColor: '#07368B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#072C69', shadowOpacity: 0.22, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  stageIconGlow: { position: 'absolute', width: 74, height: 74, borderRadius: 37, backgroundColor: '#1267D9', right: -33, top: -34, opacity: 0.68 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#145ED7', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.25 },
  title: { color: palette.navy, fontSize: 23, lineHeight: 28, fontWeight: '900', marginTop: 3 },
  identity: { color: '#52637B', fontSize: 10.5, lineHeight: 14, fontWeight: '800', marginTop: 3 },
  subtitle: { color: '#6C7889', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 4 },
  selfTrackedBadge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: '#EDF3FF', paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  selfTrackedText: { color: '#145ED7', fontSize: 10.5, fontWeight: '900' },
  actionSection: { marginTop: 0, marginBottom: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  previousButton: { flex: 0.9, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#AFC8EA', backgroundColor: '#F9FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  previousText: { color: '#0A43A3', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  primaryButton: { flex: 1.35, minHeight: 52, borderRadius: 15, backgroundColor: '#07327B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, shadowColor: '#07327B', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  buttonDisabled: { opacity: 0.5 },
  disabledText: { color: '#AEB9C8' },
  dots: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 9 },
  dot: { width: 8, height: 8, borderRadius: 999, borderWidth: 1, borderColor: '#D0D8E3', backgroundColor: '#EEF1F5' },
  dotCompleted: { borderColor: '#43A96C', backgroundColor: '#43A96C' },
  dotCurrent: { width: 11, height: 11, borderColor: '#0A43A3', backgroundColor: '#2D78E5' },
});
