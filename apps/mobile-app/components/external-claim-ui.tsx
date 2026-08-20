import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { palette } from '@/lib/theme';

export function ExternalClaimStageHeader({
  step,
  title,
  subtitle,
  vehicleNo,
  claimNo,
  onBack,
}: {
  step: number;
  title: string;
  subtitle?: string;
  vehicleNo?: string | null;
  claimNo?: string | null;
  onBack: () => void;
}) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>STEP {step} OF 9</Text>
          <Text style={styles.title}>{title}</Text>
          {vehicleNo || claimNo ? <Text style={styles.identity}>{[vehicleNo, claimNo].filter(Boolean).join(' · ')}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <AppBadge label="Self Tracked" tone="info" />
      </View>
      <ClaimProgressStrip step={step} />
    </View>
  );
}

export function ClaimProgressStrip({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap} accessible accessibilityLabel={`Claim progress step ${step} of 9`}>
      {Array.from({ length: 9 }, (_, index) => {
        const item = index + 1;
        const complete = item < step;
        const current = item === step;
        return <View key={item} style={[styles.progressSegment, complete && styles.progressComplete, current && styles.progressCurrent]} />;
      })}
    </View>
  );
}

export function ClaimContextStrip({ previousLabel, previousValue, amount }: { previousLabel?: string | null; previousValue?: string | null; amount?: string | null }) {
  if (!previousLabel && !previousValue && !amount) return null;
  return (
    <View style={styles.contextStrip}>
      <View style={styles.contextIcon}><MaterialCommunityIcons name="timeline-clock-outline" size={18} color="#0A43A3" /></View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextEyebrow}>PREVIOUS CLAIM EVENT</Text>
        {previousLabel ? <Text style={styles.contextTitle}>{previousLabel}</Text> : null}
        <Text style={styles.contextMeta}>{[previousValue, amount].filter(Boolean).join(' · ')}</Text>
      </View>
    </View>
  );
}

export function ClaimFormSection({ title, subtitle, optional, icon, children }: PropsWithChildren<{ title: string; subtitle?: string; optional?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon ? <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View> : null}
        <View style={styles.sectionCopy}>
          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{optional ? <Text style={styles.optional}>Optional</Text> : null}</View>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function ClaimChoice({ label, value, options, onChange }: { label: string; value?: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <View>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const active = value === option.value;
          return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={[styles.choice, active && styles.choiceActive]}>{active ? <MaterialCommunityIcons name="check-circle" size={16} color="#0A43A3" /> : null}<Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text></Pressable>;
        })}
      </View>
    </View>
  );
}

export function ClaimInlineNote({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'warning' }>) {
  const warning = tone === 'warning';
  return <View style={[styles.note, warning && styles.noteWarning]}><MaterialCommunityIcons name={warning ? 'alert-circle-outline' : 'information-outline'} size={17} color={warning ? '#9A6700' : '#0A43A3'} /><Text style={[styles.noteText, warning && styles.noteTextWarning]}>{children}</Text></View>;
}

export function ClaimFinancialSummary({ rows }: { rows: Array<{ label: string; value: string; emphasis?: boolean }> }) {
  if (!rows.length) return null;
  return (
    <View style={styles.financialBox}>
      <Text style={styles.financialEyebrow}>FINANCIAL PROGRESS</Text>
      {rows.map((row, index) => <View key={`${row.label}-${index}`} style={[styles.financialRow, row.emphasis && styles.financialRowEmphasis]}><Text style={[styles.financialLabel, row.emphasis && styles.financialLabelEmphasis]}>{row.label}</Text><Text style={[styles.financialValue, row.emphasis && styles.financialValueEmphasis]}>{row.value}</Text></View>)}
    </View>
  );
}

export function ClaimPrimaryAction({ label, icon = 'arrow-right', disabled, onPress }: { label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryAction, disabled && styles.primaryActionDisabled]}><Text style={styles.primaryActionText}>{label}</Text><MaterialCommunityIcons name={icon} size={19} color="#FFFFFF" /></Pressable>;
}

export function ClaimSecondaryAction({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}><MaterialCommunityIcons name={icon} size={18} color={palette.navy} /><Text style={styles.secondaryActionText}>{label}</Text></Pressable>;
}

export function ClaimMetaRow({ children }: { children: ReactNode }) { return <View style={styles.metaRow}>{children}</View>; }

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 12 }, headerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: '#0A43A3', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 }, title: { color: palette.navy, fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 2 }, identity: { color: '#344054', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 3 }, subtitle: { color: '#667085', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 4 }, progressWrap: { marginTop: 12, flexDirection: 'row', gap: 4 }, progressSegment: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#E4E9F0' }, progressComplete: { backgroundColor: '#12805C' }, progressCurrent: { backgroundColor: '#0A43A3' },
  contextStrip: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }, contextIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, contextCopy: { flex: 1, minWidth: 0 }, contextEyebrow: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 }, contextTitle: { color: palette.navy, fontSize: 12, fontWeight: '900', marginTop: 1 }, contextMeta: { color: '#667085', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', marginBottom: 10, overflow: 'hidden' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, sectionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, sectionCopy: { flex: 1, minWidth: 0 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, optional: { color: '#98A2B3', fontSize: 9.5, fontWeight: '800' }, sectionSubtitle: { color: '#667085', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 2 }, sectionBody: { padding: 12 },
  choiceLabel: { color: '#344054', fontSize: 11.5, fontWeight: '800', marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, choiceActive: { backgroundColor: '#EEF5FF', borderColor: '#7BA6E6' }, choiceText: { color: '#5E6C80', fontSize: 11.5, fontWeight: '800' }, choiceTextActive: { color: '#0A43A3' },
  note: { marginTop: 10, borderRadius: 12, backgroundColor: '#F6FAFF', padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, noteWarning: { backgroundColor: '#FFF9EB' }, noteText: { flex: 1, color: '#4F6380', fontSize: 10.5, lineHeight: 15, fontWeight: '700' }, noteTextWarning: { color: '#77520B' },
  financialBox: { borderRadius: 14, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#F8FAFC', padding: 11, marginTop: 10 }, financialEyebrow: { color: '#667085', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6, marginBottom: 5 }, financialRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#E7ECF2' }, financialRowEmphasis: { minHeight: 36 }, financialLabel: { color: '#667085', fontSize: 10.5, fontWeight: '700' }, financialLabelEmphasis: { color: palette.navy, fontWeight: '900' }, financialValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, financialValueEmphasis: { fontSize: 13 },
  primaryAction: { minHeight: 50, borderRadius: 15, backgroundColor: palette.navy, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2, marginBottom: 10 }, primaryActionDisabled: { opacity: 0.5 }, primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, secondaryAction: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryActionText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
