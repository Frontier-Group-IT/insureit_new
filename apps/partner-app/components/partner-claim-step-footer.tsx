import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CLAIM_STAGES } from '@/lib/claim-tracker';

type Props = {
  index: number;
  busy?: boolean;
  canContinue?: boolean;
  onPrevious: () => void;
  onContinue?: () => void;
  continueLabel?: string;
};

/** Nine-stage indicator. Navigation is permitted only through authorized workflow actions. */
export function PartnerClaimStepFooter({ index, busy = false, canContinue = false, onPrevious, onContinue, continueLabel = 'Continue' }: Props) {
  return <View style={styles.root}>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous claim stage" onPress={onPrevious} disabled={busy}
        style={[styles.button, styles.previous, busy && styles.disabled]}>
        <Ionicons name="arrow-back" size={18} color="#326399"/>
        <Text style={styles.previousText}>Previous</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={continueLabel} accessibilityState={{ disabled: busy || !canContinue }}
        onPress={onContinue} disabled={busy || !canContinue}
        style={[styles.button, styles.continue, (busy || !canContinue) && styles.disabled]}>
        <Text style={styles.continueText}>{busy ? 'Saving…' : continueLabel}</Text>
        <Ionicons name="arrow-forward" size={19} color="#FFF"/>
      </Pressable>
    </View>
    <View accessible accessibilityLabel={`Claim stage ${index + 1} of ${CLAIM_STAGES.length}`} style={styles.dots}>
      {CLAIM_STAGES.map((stage, i) => <View key={stage.key} style={[styles.dot, i === index && styles.activeDot, i < index && styles.completedDot]}/>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { paddingHorizontal: 15, paddingTop: 11, paddingBottom: 17, gap: 17, backgroundColor: '#EDF6FE' },
  actions: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 52, borderRadius: 13, flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center' },
  previous: { backgroundColor: '#F9FCFF', borderColor: '#C6D6E7', borderWidth: 1 },
  previousText: { color: '#356393', fontSize: 13, fontWeight: '800' },
  continue: { backgroundColor: '#0B347A' },
  continueText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: .45 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  dot: { height: 7, width: 7, borderRadius: 8, backgroundColor: '#D9E0EA' },
  completedDot: { backgroundColor: '#7CA8E7' },
  activeDot: { height: 11, width: 11, backgroundColor: '#1467CF', borderWidth: 1, borderColor: '#0B4B99' },
});
