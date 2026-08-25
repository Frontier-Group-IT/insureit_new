import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_MANAGED_MILESTONES, type ClaimMilestone } from '@/lib/claim-service-mode';

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
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const [assistanceTooltipVisible, setAssistanceTooltipVisible] = useState(false);
  const icon = stageIcons[Math.max(0, Math.min(stageIcons.length - 1, step - 1))];
  const claimId = typeof params.id === 'string' ? params.id : '';
  const returnStage = typeof params.key === 'string' ? params.key : 'claim_intimation';

  function openAssistance() {
    if (!claimId) return;
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId, returnStage } });
  }

  function showLongPressTooltip() {
    setAssistanceTooltipVisible(true);
    setTimeout(() => setAssistanceTooltipVisible(false), 1600);
  }

  return (
    <View style={styles.headerWrap}>
      <View style={styles.stageHero}>
        <View style={styles.stageIcon}>
          <View style={styles.stageIconGlow} />
          <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.assistanceWrap}>
          {assistanceTooltipVisible ? <View style={styles.assistanceTooltip} pointerEvents="none"><Text style={styles.assistanceTooltipText}>Get Assistance</Text></View> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get Assistance"
            accessibilityHint="Opens the existing claim assistance flow"
            disabled={!claimId}
            onPress={openAssistance}
            onLongPress={showLongPressTooltip}
            onHoverIn={() => setAssistanceTooltipVisible(true)}
            onHoverOut={() => setAssistanceTooltipVisible(false)}
            style={({ pressed }) => [styles.assistanceButton, pressed && styles.assistanceButtonPressed, !claimId && styles.buttonDisabled]}
          >
            <MaterialCommunityIcons name="help-circle-outline" size={23} color="#145ED7" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CompactDocumentActionBar({ claimId, step, primaryLabel, primaryDisabled, onPrimary }: ActionProps) {
  const router = useRouter();
  const currentIndex = Math.max(0, Math.min(SELF_MANAGED_MILESTONES.length - 1, step - 1));
  const previousEnabled = Boolean(claimId) && currentIndex > 0;

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

      <View style={styles.bottomDots} accessibilityLabel={`Claim progress step ${step} of 9`}>
        {SELF_MANAGED_MILESTONES.map((stage, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          return <View key={stage.key} style={[styles.dot, completed && styles.dotCompleted, current && styles.dotCurrent]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 10, marginTop: -4 },
  stageHero: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 2, minHeight: 54 },
  stageIcon: { position: 'relative', width: 34, height: 34, borderRadius: 11, backgroundColor: '#07368B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#072C69', shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3, marginTop: 1 },
  stageIconGlow: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: '#1267D9', right: -17, top: -17, opacity: 0.68 },
  headerCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
  title: { color: '#071F49', fontSize: 22, lineHeight: 27, fontWeight: '900' },
  assistanceWrap: { position: 'relative', alignSelf: 'flex-start', marginTop: 0 },
  assistanceButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: '#C6D9F5', backgroundColor: '#EDF3FF', alignItems: 'center', justifyContent: 'center' },
  assistanceButtonPressed: { backgroundColor: '#E0EBFF', transform: [{ scale: 0.97 }] },
  assistanceTooltip: { position: 'absolute', right: 0, bottom: 46, backgroundColor: '#0A2858', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, zIndex: 10, minWidth: 94, alignItems: 'center' },
  assistanceTooltipText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  actionSection: { marginTop: 0, marginBottom: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  previousButton: { flex: 0.9, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#AFC8EA', backgroundColor: '#F9FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  previousText: { color: '#0A43A3', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  primaryButton: { flex: 1.35, minHeight: 52, borderRadius: 15, backgroundColor: '#07327B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, shadowColor: '#07327B', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  buttonDisabled: { opacity: 0.5 },
  disabledText: { color: '#AEB9C8' },
  bottomDots: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 9 },
  dot: { width: 8, height: 8, borderRadius: 999, borderWidth: 1, borderColor: '#D0D8E3', backgroundColor: '#EEF1F5' },
  dotCompleted: { borderColor: '#43A96C', backgroundColor: '#43A96C' },
  dotCurrent: { width: 11, height: 11, borderColor: '#0A43A3', backgroundColor: '#2D78E5' },
});
