import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { palette } from '@/lib/theme';
import type { ClaimMilestoneKey } from '@/lib/claim-service-mode';

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Icon shown in the stage hero for each of the nine self-managed claim
 * milestones. Keeping this map here (rather than in `lib/claim-service-mode`)
 * avoids changing that file's data contract.
 */
export const CLAIM_STAGE_ICON: Record<ClaimMilestoneKey, Icon> = {
  spot_intimation: 'car-emergency',
  spot_status: 'clipboard-search-outline',
  claim_intimation: 'clipboard-text-outline',
  work_approval: 'clipboard-check-outline',
  repair_ri: 'car-wrench',
  billing: 'receipt-text-outline',
  delivery_order: 'truck-delivery-outline',
  vehicle_delivery: 'car-side',
  payment_encashment: 'cash-multiple',
};

/**
 * Shared branded header for every self-managed claim stage screen: a stage
 * hero icon, "STEP X OF 9" eyebrow, title/subtitle, and the ownership badge.
 * `Screen` already renders the app back button, so this header intentionally
 * does not duplicate it.
 */
export function ClaimStageHeader({
  step,
  totalSteps = 9,
  icon,
  title,
  subtitle,
  badgeLabel = 'Self Tracked',
  badgeTone = 'info',
}: {
  step: number;
  totalSteps?: number;
  icon: Icon;
  title: string;
  subtitle?: string;
  badgeLabel?: string;
  badgeTone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.heroIcon}>
        <MaterialCommunityIcons name={icon} size={22} color="#0A43A3" />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>STEP {step} OF {totalSteps}</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <AppBadge label={badgeLabel} tone={badgeTone} />
    </View>
  );
}

/** Shared segmented progress rail used across every claim stage screen. */
export function ClaimProgressRail({ step, totalSteps = 9 }: { step: number; totalSteps?: number }) {
  return (
    <View style={styles.progressRail} accessibilityLabel={`Claim progress step ${step} of ${totalSteps}`}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <View key={index} style={[styles.progressSegment, index < step && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

/** Shared "CLAIM UPDATE" guidance card used to frame what a stage expects. */
export function ClaimUpdateContext({
  title,
  body,
  icon = 'shield-check-outline',
  label = 'CLAIM UPDATE',
}: {
  title: string;
  body: string;
  icon?: Icon;
  label?: string;
}) {
  return (
    <View style={styles.contextCard}>
      <View style={styles.contextIcon}><MaterialCommunityIcons name={icon} size={22} color="#B7791F" /></View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text style={styles.contextTitle}>{title}</Text>
        <Text style={styles.contextBody}>{body}</Text>
      </View>
    </View>
  );
}

/** Shared white card wrapper for the fields of a claim stage. */
export function StageDetailsCard({
  icon = 'clipboard-edit-outline',
  title,
  subtitle,
  children,
}: PropsWithChildren<{ icon?: Icon; title: string; subtitle?: string }>) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardIcon}><MaterialCommunityIcons name={icon} size={20} color="#B7791F" /></View>
        <View style={styles.cardHeadingCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Shared primary save CTA used to finish/record a claim stage. */
export function StageSaveButton({
  label,
  savingLabel = 'Saving...',
  saving = false,
  disabled = false,
  onPress,
}: {
  label: string;
  savingLabel?: string;
  saving?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const isDisabled = saving || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: saving }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.saveButton, isDisabled && styles.saveButtonDisabled, pressed && !isDisabled && styles.saveButtonPressed]}
    >
      <Text style={styles.saveButtonText}>{saving ? savingLabel : label}</Text>
      <MaterialCommunityIcons name="check" size={19} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: palette.navy, fontSize: 21, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#7A8799', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },

  progressRail: { flexDirection: 'row', gap: 6, marginBottom: 14, paddingHorizontal: 2 },
  progressSegment: { flex: 1, height: 6, borderRadius: 4, backgroundColor: '#E4E9F1' },
  progressSegmentActive: { backgroundColor: '#0A43A3' },

  contextCard: { borderWidth: 1, borderColor: '#C9DAF2', borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7FAFF', marginBottom: 12 },
  contextIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  contextTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  contextBody: { color: '#667085', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },

  card: { borderRadius: 17, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', marginBottom: 12 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF4E2', alignItems: 'center', justifyContent: 'center' },
  cardHeadingCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  cardSub: { color: '#7A8799', fontSize: 9.8, fontWeight: '600', marginTop: 2 },

  saveButton: { minHeight: 50, borderRadius: 15, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  saveButtonPressed: { opacity: 0.88 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
