import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { palette } from '@/lib/theme';

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

export function ExternalClaimStageHeader({
  step,
  title,
  subtitle,
  vehicleNo,
  claimNo,
}: {
  step: number;
  title: string;
  subtitle?: string;
  vehicleNo?: string | null;
  claimNo?: string | null;
  onBack: () => void;
}) {
  const icon = stageIcons[Math.max(0, Math.min(stageIcons.length - 1, step - 1))];
  return (
    <View style={styles.headerWrap}>
      <ClaimProgressStrip step={step} />
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

export function ClaimProgressStrip({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap} accessible accessibilityLabel={`Claim progress step ${step} of 9`}>
      {Array.from({ length: 9 }, (_, index) => {
        const item = index + 1;
        const active = item <= step;
        return <View key={item} style={[styles.progressSegment, active && styles.progressActive]} />;
      })}
    </View>
  );
}

export function ClaimStageSummaryCard({ title, body, label = 'CLAIM UPDATE', note = 'This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.', icon = 'shield-check-outline' }: { title: string; body: string; label?: string; note?: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryArcOne} />
      <View style={styles.summaryArcTwo} />
      <View style={styles.summaryTop}>
        <View style={styles.summaryIcon}><MaterialCommunityIcons name={icon} size={28} color="#083B9B" /></View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryEyebrow}>{label}</Text>
          <Text style={styles.summaryTitle}>{title}</Text>
          <Text style={styles.summaryBody}>{body}</Text>
        </View>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryNoteRow}>
        <MaterialCommunityIcons name="information-outline" size={24} color="#FFFFFF" />
        <Text style={styles.summaryNote}>{note}</Text>
      </View>
    </View>
  );
}

export function ClaimContextStrip({ previousLabel, previousValue, amount }: { previousLabel?: string | null; previousValue?: string | null; amount?: string | null }) {
  if (!previousLabel && !previousValue && !amount) return null;
  return (
    <View style={styles.contextStrip}>
      <View style={styles.contextIcon}><MaterialCommunityIcons name="timeline-clock-outline" size={19} color="#0A43A3" /></View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextEyebrow}>PREVIOUS EVENT</Text>
        {previousLabel ? <Text style={styles.contextTitle}>{previousLabel}</Text> : null}
        <Text style={styles.contextMeta}>{[previousValue, amount].filter(Boolean).join('  •  ')}</Text>
      </View>
      <MaterialCommunityIcons name="check-circle-outline" size={20} color="#7E9AC0" />
    </View>
  );
}

export function ClaimFormSection({ title, subtitle, optional, icon, children }: PropsWithChildren<{ title: string; subtitle?: string; optional?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon ? <View style={styles.sectionIcon}><MaterialCommunityIcons name={icon} size={23} color="#FFFFFF" /></View> : null}
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
          return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={[styles.choice, active && styles.choiceActive]}>
            <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>
  );
}

export function ClaimInlineNote({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'warning' }>) {
  const warning = tone === 'warning';
  return <View style={[styles.note, warning && styles.noteWarning]}><MaterialCommunityIcons name={warning ? 'alert-circle-outline' : 'information-outline'} size={18} color={warning ? '#9A6700' : '#0A43A3'} /><Text style={[styles.noteText, warning && styles.noteTextWarning]}>{children}</Text></View>;
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

export function ClaimPrimaryAction({ label, icon = 'arrow-right', disabled, fill = false, onPress }: { label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; disabled?: boolean; fill?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.primaryAction, fill && styles.actionBarItem, disabled && styles.primaryActionDisabled]}><Text style={styles.primaryActionText}>{label}</Text><MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" /></Pressable>;
}

export function ClaimSecondaryAction({ icon, label, fill = false, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; fill?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.secondaryAction, fill && styles.actionBarItem]}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /><Text style={styles.secondaryActionText}>{label}</Text></Pressable>;
}

export function ClaimActionBar({ primaryLabel, primaryIcon = 'arrow-right', primaryDisabled, onPrimary, onAssistance }: { primaryLabel: string; primaryIcon?: keyof typeof MaterialCommunityIcons.glyphMap; primaryDisabled?: boolean; onPrimary: () => void; onAssistance: () => void }) {
  return (
    <View style={styles.actionBar}>
      <ClaimSecondaryAction fill icon="account-tie-voice-outline" label="Get Assistance" onPress={onAssistance} />
      <ClaimPrimaryAction fill label={primaryLabel} icon={primaryIcon} disabled={primaryDisabled} onPress={onPrimary} />
    </View>
  );
}

export function ClaimMetaRow({ children }: { children: ReactNode }) { return <View style={styles.metaRow}>{children}</View>; }

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 14 },
  progressWrap: { flexDirection: 'row', gap: 7, paddingHorizontal: 3, marginBottom: 18 },
  progressSegment: { flex: 1, height: 7, borderRadius: 999, backgroundColor: '#DEE4EC' },
  progressActive: { backgroundColor: '#135DD8' },
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
  summaryCard: { position: 'relative', borderRadius: 20, backgroundColor: '#07327B', padding: 16, marginBottom: 13, overflow: 'hidden', shadowColor: '#072C69', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  summaryArcOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: 'rgba(72,139,255,0.22)', right: -95, top: -105 },
  summaryArcTwo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: 'rgba(72,139,255,0.18)', right: -48, top: -72 },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryEyebrow: { color: '#CFDDF5', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.55 },
  summaryTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 3 },
  summaryBody: { color: '#E1E9F6', fontSize: 11, lineHeight: 17, fontWeight: '600', marginTop: 5 },
  summaryDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.38)', marginVertical: 13 },
  summaryNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  summaryNote: { flex: 1, color: '#EEF4FD', fontSize: 10.5, lineHeight: 16, fontWeight: '600' },
  contextStrip: { minHeight: 65, borderRadius: 15, borderWidth: 1, borderColor: '#D9E3EE', backgroundColor: '#F9FBFE', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  contextIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextEyebrow: { color: '#7085A2', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  contextTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 1 },
  contextMeta: { color: '#68778B', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  section: { borderRadius: 18, borderWidth: 1, borderColor: '#DDE4EC', backgroundColor: '#FFFFFF', marginBottom: 12, overflow: 'hidden', shadowColor: '#183658', shadowOpacity: 0.055, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 10 },
  sectionIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#073C97', alignItems: 'center', justifyContent: 'center', shadowColor: '#073C97', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  optional: { color: '#667085', fontSize: 10.5, fontWeight: '700' },
  sectionSubtitle: { color: '#788497', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  sectionBody: { paddingHorizontal: 13, paddingBottom: 13, backgroundColor: '#FFFFFF' },
  choiceLabel: { color: '#172E55', fontSize: 11.5, fontWeight: '800', marginBottom: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 45, minWidth: 112, borderRadius: 12, borderWidth: 1, borderColor: '#D3DAE4', backgroundColor: '#FFFFFF', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  choiceActive: { borderColor: '#165DDB', backgroundColor: '#F7FAFF' },
  choiceText: { color: '#6D7789', fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: '#145ED7' },
  note: { marginTop: 10, borderRadius: 12, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D7E4FB', padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  noteWarning: { backgroundColor: '#FFF8E8', borderColor: '#F1DDAA' },
  noteText: { flex: 1, color: '#23549B', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  noteTextWarning: { color: '#77520B' },
  financialBox: { position: 'relative', borderRadius: 16, backgroundColor: '#082E69', padding: 12, marginTop: 11, overflow: 'hidden' },
  financialOrb: { position: 'absolute', width: 100, height: 100, borderRadius: 50, right: -40, top: -55, backgroundColor: '#165DDB', opacity: 0.45 },
  financialHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  financialIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#174885', alignItems: 'center', justifyContent: 'center' },
  financialEyebrow: { color: '#D9E7FA', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 },
  financialSub: { color: '#9CB6D5', fontSize: 9, fontWeight: '700', marginTop: 1 },
  financialRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  financialRowEmphasis: { minHeight: 40, marginHorizontal: -4, paddingHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.06)' },
  financialLabel: { color: '#BFD0E5', fontSize: 10.5, fontWeight: '700' },
  financialLabelEmphasis: { color: '#FFFFFF', fontWeight: '900' },
  financialValue: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  financialValueEmphasis: { fontSize: 13.5, color: '#DDF7ED' },
  primaryAction: { minHeight: 52, borderRadius: 15, backgroundColor: '#07327B', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#07327B', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryActionDisabled: { opacity: 0.5 },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  secondaryAction: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#BFD2EE', backgroundColor: '#F7FAFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryActionText: { color: '#0A43A3', fontSize: 10.5, lineHeight: 14, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  actionBar: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 2, marginBottom: 10 },
  actionBarItem: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
