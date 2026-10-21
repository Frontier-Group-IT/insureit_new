import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CLAIM_STAGES } from '@/lib/claim-tracker';

type Draft = {
  customer: string;
  vehicle: string;
  policy: string;
  insurer: string;
  accidentDate: string;
  accidentTime: string;
  accidentLocation: string;
  description: string;
};

const initialDraft: Draft = {
  customer: '', vehicle: '', policy: '', insurer: '',
  accidentDate: '', accidentTime: '', accidentLocation: '', description: '',
};

/**
 * Entry UI only. The existing Partner claim RPCs provide scoped reads, not a verified
 * create/draft endpoint. Never write directly to claim tables or fake a saved claim.
 */
export default function PartnerAddClaimScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [expanded, setExpanded] = useState(false);
  const update = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));

  return (
    <View style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Claims" onPress={() => router.back()} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.topTitle}>Add New Claim</Text>
            <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroBody}>
            <View>
              <Text style={styles.eyebrow}>NEW CLAIM JOURNEY</Text>
              <Text style={styles.stageTitle}>Spot Intimation</Text>
              <Text style={styles.stageSub}>Stage 1 of 9</Text>
            </View>
            <View style={styles.counter}><Text style={styles.counterText}>1/9</Text></View>
          </View>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
        </View>

        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="View all nine claim stages" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.stageToggle}>
            <Ionicons name="list-outline" size={20} color="#1657B2" />
            <Text style={styles.sectionHeading}>View all 9 stages</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color="#506580" />
          </Pressable>
          {expanded ? CLAIM_STAGES.map((stage, index) => (
            <View key={stage.key} style={styles.stageRow}>
              <View style={[styles.stageCircle, index === 0 && styles.stageCircleActive]}>
                <Text style={[styles.stageNumber, index === 0 && styles.stageNumberActive]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stageLabel, index === 0 && styles.stageLabelActive]}>{stage.label}</Text>
              {index === 0 ? <Text style={styles.current}>CURRENT</Text> : <Ionicons name="lock-closed-outline" size={14} color="#9AA9BD" />}
            </View>
          )) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.headingRow}>
            <Text style={styles.sectionHeading}>Claim Information</Text>
            <Text style={styles.stageChip}>STAGE 1</Text>
          </View>
          <Text style={styles.note}>Select a customer, vehicle and policy to initiate a claim. The secure creation service must be connected before submission.</Text>
          <Field label="Customer *" value={draft.customer} onChangeText={(value) => update('customer', value)} placeholder="Customer name (selection pending)" />
          <Field label="Vehicle *" value={draft.vehicle} onChangeText={(value) => update('vehicle', value)} placeholder="Vehicle number (selection pending)" />
          <Field label="Policy" value={draft.policy} onChangeText={(value) => update('policy', value)} placeholder="Linked policy number" />
          <Field label="Insurer" value={draft.insurer} onChangeText={(value) => update('insurer', value)} placeholder="Insurer (verified autofill pending)" />
          <View style={styles.twoColumns}>
            <View style={styles.half}><Field label="Accident Date" value={draft.accidentDate} onChangeText={(value) => update('accidentDate', value)} placeholder="DD/MM/YYYY" /></View>
            <View style={styles.half}><Field label="Accident Time" value={draft.accidentTime} onChangeText={(value) => update('accidentTime', value)} placeholder="HH:MM" /></View>
          </View>
          <Field label="Accident Location" value={draft.accidentLocation} onChangeText={(value) => update('accidentLocation', value)} placeholder="Location of incident" />
          <Field label="Incident Description" value={draft.description} onChangeText={(value) => update('description', value)} placeholder="Describe the incident" multiline />
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="cloud-upload-outline" size={24} color="#2468B6" />
            <Text style={styles.uploadTitle}>Spot photographs / documents</Text>
            <Text style={styles.uploadHint}>Secure uploads will be enabled with the claim creation service</Text>
          </View>
          <View style={styles.actions}>
            <View style={styles.secondary}><Text style={styles.secondaryText}>Save Draft</Text></View>
            <View style={styles.primary}><Text style={styles.primaryText}>Save & Continue</Text><Ionicons name="arrow-forward" size={15} color="#D5E1FA" /></View>
          </View>
          <Text style={styles.disabledNote}>Saving and stage progression are disabled until the authorized creation backend is available. Your entries are not uploaded or saved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A4B7" multiline={multiline}
        style={[styles.input, multiline && styles.multiline]} autoCapitalize="sentences" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6FB' },
  content: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 40, gap: 12 },
  hero: { backgroundColor: '#0B4089', borderRadius: 17, padding: 14, gap: 17 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { padding: 3 },
  topTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  heroBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#BFD8F8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  stageTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 5 },
  stageSub: { color: '#D5E7FF', fontSize: 12, marginTop: 4 },
  counter: { padding: 12, borderRadius: 35, backgroundColor: '#245DA4' },
  counterText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#587CB2', overflow: 'hidden' },
  progressFill: { height: 5, width: '11.11%', backgroundColor: '#FFFFFF', borderRadius: 4 },
  card: { borderRadius: 16, padding: 14, backgroundColor: '#FFFFFF', gap: 12, borderWidth: 1, borderColor: '#E2EAF5' },
  stageToggle: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 28 },
  sectionHeading: { flex: 1, color: '#152D52', fontSize: 15, fontWeight: '800' },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  stageCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDF3FA', alignItems: 'center', justifyContent: 'center' },
  stageCircleActive: { backgroundColor: '#1657B2' },
  stageNumber: { color: '#74859D', fontWeight: '700', fontSize: 12 },
  stageNumberActive: { color: '#FFFFFF' },
  stageLabel: { flex: 1, color: '#6E8197', fontSize: 12 },
  stageLabelActive: { color: '#133B77', fontWeight: '800' },
  current: { color: '#138A66', fontWeight: '800', fontSize: 9 },
  headingRow: { flexDirection: 'row', alignItems: 'center' },
  stageChip: { color: '#1C5CAE', fontSize: 10, fontWeight: '800', backgroundColor: '#EBF3FF', padding: 6, borderRadius: 7 },
  note: { color: '#657993', fontSize: 11, lineHeight: 16 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#304968' },
  input: { minHeight: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: '#DBE5F2', borderRadius: 8, fontSize: 13, color: '#152D52', backgroundColor: '#FFFFFF' },
  multiline: { height: 84, textAlignVertical: 'top', paddingTop: 10 },
  twoColumns: { flexDirection: 'row', gap: 9 },
  half: { flex: 1 },
  uploadPlaceholder: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#B6C9E3', borderRadius: 10, padding: 18, gap: 5, backgroundColor: '#F7FAFF' },
  uploadTitle: { color: '#2468B6', fontWeight: '800', fontSize: 12 },
  uploadHint: { textAlign: 'center', color: '#7B8DA5', fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F0EFFF', opacity: 0.6 },
  secondaryText: { color: '#635A8A', fontWeight: '800', fontSize: 12 },
  primary: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', gap: 4, flexDirection: 'row', borderRadius: 8, backgroundColor: '#8B78DB' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  disabledNote: { textAlign: 'center', color: '#8A5761', fontSize: 10, lineHeight: 15 },
});
