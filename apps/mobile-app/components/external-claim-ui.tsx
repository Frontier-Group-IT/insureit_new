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
      <View style={styles.headerGlowLarge} />
      <View style={styles.headerGlowSmall} />
      <View style={styles.headerAccent} />
      <View style={styles.headerTopRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.stepMedallion}>
          <Text style={styles.stepNumber}>{step}</Text>
          <Text style={styles.stepOf}>/ 9</Text>
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.headerMetaRow}>
            <Text style={styles.eyebrow}>CLAIM WORKSPACE</Text>
            <AppBadge label="Self Tracked" tone="info" />
          </View>
          <Text style={styles.title}>{title}</Text>
          {vehicleNo || claimNo ? <View style={styles.identityRow}><MaterialCommunityIcons name="car-outline" size={14} color="#355B8C" /><Text style={styles.identity}>{[vehicleNo, claimNo].filter(Boolean).join(' · ')}</Text></View> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <ClaimProgressStrip step={step} />
    </View>
  );
}

export function ClaimProgressStrip({ step }: { step: number }) {
  return (
    <View style={styles.progressShell} accessible accessibilityLabel={`Claim progress step ${step} of 9`}>
      <View style={styles.progressWrap}>
        {Array.from({ length: 9 }, (_, index) => {
          const item = index + 1;
          const complete = item < step;
          const current = item === step;
          return <View key={item} style={[styles.progressSegment, complete && styles.progressComplete, current && styles.progressCurrent]} />;
        })}
      </View>
      <View style={styles.progressCaptionRow}>
        <Text style={styles.progressCaption}>CLAIM PROGRESS</Text>
        <Text style={styles.progressValue}>Stage {step} of 9</Text>
      </View>
    </View>
  );
}

export function ClaimContextStrip({ previousLabel, previousValue, amount }: { previousLabel?: string | null; previousValue?: string | null; amount?: string | null }) {
  if (!previousLabel && !previousValue && !amount) return null;
  return (
    <View style={styles.contextStrip}>
      <View style={styles.contextAccent} />
      <View style={styles.contextIcon}><MaterialCommunityIcons name="timeline-clock-outline" size={19} color="#0A43A3" /></View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextEyebrow}>PREVIOUS CLAIM EVENT</Text>
        {previousLabel ? <Text style={styles.contextTitle}>{previousLabel}</Text> : null}
        <Text style={styles.contextMeta}>{[previousValue, amount].filter(Boolean).join('  •  ')}</Text>
      </View>
      <MaterialCommunityIcons name="check-decagram" size={20} color="#89A9D1" />
    </View>
  );
}

export function ClaimFormSection({ title, subtitle, optional, icon, children }: PropsWithChildren<{ title: string; subtitle?: string; optional?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionAccent} />
      <View style={styles.sectionHeader}>
        {icon ? <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={20} color="#0A43A3" /></View> : null}
        <View style={styles.sectionCopy}>
          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{optional ? <Text style={styles.optional}>OPTIONAL</Text> : null}</View>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.sectionMark}><MaterialCommunityIcons name="rhombus-medium" size={18} color="#B8CBE6" /></View>
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
          return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={[styles.choice, active && styles.choiceActive]}>{active ? <View style={styles.choiceCheck}><MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /></View> : <View style={styles.choiceDot} />}<Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text></Pressable>;
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
      <View style={styles.financialOrb} />
      <View style={styles.financialHeader}>
        <View style={styles.financialIcon}><MaterialCommunityIcons name="finance" size={18} color="#D8E7FF" /></View>
        <View><Text style={styles.financialEyebrow}>FINANCIAL PROGRESS</Text><Text style={styles.financialSub}>Claim value movement</Text></View>
      </View>
      {rows.map((row, index) => <View key={`${row.label}-${index}`} style={[styles.financialRow, row.emphasis && styles.financialRowEmphasis]}><Text style={[styles.financialLabel, row.emphasis && styles.financialLabelEmphasis]}>{row.label}</Text><Text style={[styles.financialValue, row.emphasis && styles.financialValueEmphasis]}>{row.value}</Text></View>)}
    </View>
  );
}

export function ClaimPrimaryAction({ label, icon = 'arrow-right', disabled, onPress }: { label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryAction, disabled && styles.primaryActionDisabled]}><View style={styles.primaryActionShine} /><Text style={styles.primaryActionText}>{label}</Text><View style={styles.primaryActionIcon}><MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" /></View></Pressable>;
}

export function ClaimSecondaryAction({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.secondaryAction}><View style={styles.secondaryIcon}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /></View><Text style={styles.secondaryActionText}>{label}</Text></Pressable>;
}

export function ClaimMetaRow({ children }: { children: ReactNode }) { return <View style={styles.metaRow}>{children}</View>; }

const styles = StyleSheet.create({
  headerWrap: { position: 'relative', marginBottom: 12, borderRadius: 22, borderWidth: 1, borderColor: '#C9D9EF', backgroundColor: '#F4F8FF', padding: 13, overflow: 'hidden', shadowColor: '#0B2D59', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  headerGlowLarge: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#DDEAFF', right: -46, top: -68, opacity: 0.78 },
  headerGlowSmall: { position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: '#C9DDF9', right: 42, top: -27, opacity: 0.55 },
  headerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#0A43A3' },
  headerTopRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#C9D9EF', backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  stepMedallion: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#102F59', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#102F59', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  stepNumber: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' }, stepOf: { color: '#BDD2EE', fontSize: 9, fontWeight: '900', marginLeft: 2, marginTop: 4 },
  headerCopy: { flex: 1, minWidth: 0 }, headerMetaRow: { minHeight: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { color: palette.navy, fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 2 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }, identity: { color: '#35506F', fontSize: 11.5, lineHeight: 16, fontWeight: '800' }, subtitle: { color: '#667085', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 4 },
  progressShell: { marginTop: 13, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.74)', borderWidth: 1, borderColor: '#D9E5F4', padding: 9 }, progressWrap: { flexDirection: 'row', gap: 4 }, progressSegment: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#DFE6EF' }, progressComplete: { backgroundColor: '#1D8A68' }, progressCurrent: { backgroundColor: '#0A43A3' }, progressCaptionRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressCaption: { color: '#6C7C91', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 }, progressValue: { color: '#1C3558', fontSize: 9.5, fontWeight: '900' },
  contextStrip: { position: 'relative', minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: '#D6E1EF', backgroundColor: '#FFFFFF', padding: 11, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, overflow: 'hidden', shadowColor: '#163C6B', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }, contextAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#2F6CB3' }, contextIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, contextCopy: { flex: 1, minWidth: 0 }, contextEyebrow: { color: '#5B78A0', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 }, contextTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900', marginTop: 1 }, contextMeta: { color: '#5D6C80', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  section: { position: 'relative', borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', marginBottom: 11, overflow: 'hidden', shadowColor: '#14375F', shadowOpacity: 0.055, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 }, sectionAccent: { position: 'absolute', left: 0, top: 0, width: 4, height: 58, backgroundColor: '#0A43A3', zIndex: 2 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E8EEF5', backgroundColor: '#F7FAFF' }, sectionIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#E5F0FF', borderWidth: 1, borderColor: '#D1E1F5', alignItems: 'center', justifyContent: 'center' }, sectionCopy: { flex: 1, minWidth: 0 }, sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, sectionTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, optional: { color: '#60738B', fontSize: 8, fontWeight: '900', letterSpacing: 0.7, borderRadius: 999, backgroundColor: '#E9EEF5', paddingHorizontal: 7, paddingVertical: 3 }, sectionSubtitle: { color: '#63748A', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 2 }, sectionMark: { width: 24, alignItems: 'center' }, sectionBody: { padding: 13, backgroundColor: '#FFFFFF' },
  choiceLabel: { color: '#344054', fontSize: 11.5, fontWeight: '800', marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D7E1ED', backgroundColor: '#FBFCFE', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, choiceActive: { backgroundColor: '#EAF2FF', borderColor: '#5E8FCE', shadowColor: '#0A43A3', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, choiceDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: '#AEBAC8' }, choiceCheck: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' }, choiceText: { color: '#5E6C80', fontSize: 11.5, fontWeight: '800' }, choiceTextActive: { color: '#0A43A3' },
  note: { marginTop: 10, borderRadius: 12, backgroundColor: '#F4F8FD', borderWidth: 1, borderColor: '#DFE9F5', padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, noteWarning: { backgroundColor: '#FFF9EB', borderColor: '#F2DFAB' }, noteText: { flex: 1, color: '#4F6380', fontSize: 10.5, lineHeight: 15, fontWeight: '700' }, noteTextWarning: { color: '#77520B' },
  financialBox: { position: 'relative', borderRadius: 17, backgroundColor: '#102D52', padding: 12, marginTop: 11, overflow: 'hidden', shadowColor: '#102D52', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, financialOrb: { position: 'absolute', width: 100, height: 100, borderRadius: 50, right: -40, top: -55, backgroundColor: '#24558C', opacity: 0.7 }, financialHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 }, financialIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#1B4677', alignItems: 'center', justifyContent: 'center' }, financialEyebrow: { color: '#D9E7FA', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 }, financialSub: { color: '#9CB6D5', fontSize: 9, fontWeight: '700', marginTop: 1 }, financialRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }, financialRowEmphasis: { minHeight: 40, marginHorizontal: -4, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.06)' }, financialLabel: { color: '#BFD0E5', fontSize: 10.5, fontWeight: '700' }, financialLabelEmphasis: { color: '#FFFFFF', fontWeight: '900' }, financialValue: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' }, financialValueEmphasis: { fontSize: 13.5, color: '#DDF7ED' },
  primaryAction: { position: 'relative', minHeight: 52, borderRadius: 16, backgroundColor: '#102F59', paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2, marginBottom: 10, overflow: 'hidden', shadowColor: '#102F59', shadowOpacity: 0.20, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, primaryActionShine: { position: 'absolute', top: 0, left: 18, right: 18, height: 1, backgroundColor: 'rgba(255,255,255,0.34)' }, primaryActionDisabled: { opacity: 0.5 }, primaryActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, primaryActionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#1D4E84', alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D3DFEC', backgroundColor: '#FFFFFF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#173B65', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, secondaryIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#EDF4FE', alignItems: 'center', justifyContent: 'center' }, secondaryActionText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});