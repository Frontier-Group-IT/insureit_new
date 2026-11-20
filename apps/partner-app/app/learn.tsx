import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';

import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerLearningToday,
  submitPartnerLearningAnswer,
  type PartnerLearningToday,
} from '@/lib/learn';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function LearnScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerLearningToday | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setShowAnswerFeedback(false);
    setSelectedOptionKey(null);
    try {
      setData(await getPartnerLearningToday());
    } catch {
      setError('Today’s learning card could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A newly submitted answer gets one second of feedback; previously completed
  // cards never replay the feedback when the page is opened again.
  useEffect(() => {
    if (!showAnswerFeedback) return;
    const timeout = setTimeout(() => setShowAnswerFeedback(false), 1000);
    return () => clearTimeout(timeout);
  }, [showAnswerFeedback]);

  const answer = data?.answer || null;
  async function submitAnswer() {
    if (!data?.card || !selectedOptionKey || data.answered_today || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPartnerLearningAnswer(data.card.id, selectedOptionKey);
      setData(result.today);
      setSelectedOptionKey(null);
      setShowAnswerFeedback(true);
    } catch {
      setError('Your answer could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PartnerScreen title="60-Second Learn" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <View style={styles.referenceHeader}>
        <View pointerEvents="none" style={styles.headerGlow} />
        <View pointerEvents="none" style={styles.headerCurve} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.headerAction}
        >
          <Ionicons name="arrow-back" size={30} color="#FFFFFF" />
        </Pressable>
        <Image source={require('../assets/partner/learn-stopwatch-reference.png')} style={styles.headerArtwork} resizeMode="contain" />
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.referenceTitle}>60-Second Learn</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>Learn • Practice • Grow</Text>
        </View>
      </View>
      {loading ? (
        <PartnerStateView state="loading" title="Loading today’s learning card" />
      ) : error && !data ? (
        <PartnerStateView state="error" title="Learning is temporarily unavailable" message={error} actionLabel="Try again" onAction={() => void load()} />
      ) : !data?.available || !data.card ? (
        <PartnerStateView state="empty" asset={PartnerAssets.actions.policyChecklist} title="No card scheduled today" message="A new learning card will appear when content is active." />
      ) : (
        <>

          <View style={styles.statsCard}>
            <Stat value={data.stats.attempted_days} label="Learning days" icon="school" iconColor="#1373D7" />
            <View style={styles.statsDivider} />
            <Stat value={data.stats.total_attempts} label="Cards completed" icon="checkbox" iconColor="#08A58D" />
          </View>

          <View style={styles.questionSection}>
            <View style={styles.questionHeadingRow}>
              <View style={styles.lightbulbCircle}><Ionicons name="bulb" size={27} color="#0876E9" /></View>
              <View style={styles.questionHeadingCopy}>
                <Text style={styles.questionMeta}>TODAY’S QUESTION</Text>
                <View style={styles.headingUnderline} />
              </View>
            </View>
            <Text style={styles.question}>{data.card.prompt}</Text>
          </View>

          <View style={styles.optionsList} accessibilityRole="radiogroup">
            {data.card.options.map((option, index) => {
              const isSelected = (answer?.selected_option_key ?? selectedOptionKey) === option.key;
              const isCorrect = answer?.correct_option_key === option.key;
              const showCorrect = Boolean(answer && isCorrect);
              const showWrong = Boolean(answer && isSelected && !answer.is_correct);
              const optionColor = ['#1256C9', '#079D82', '#F87814', '#8524AF'][index % 4];
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityLabel={'Answer ' + String.fromCharCode(65 + index) + ': ' + option.label}
                  accessibilityState={{ disabled: Boolean(data.answered_today || submitting), checked: Boolean(isSelected) }}
                  disabled={Boolean(data.answered_today || submitting)}
                  onPress={() => setSelectedOptionKey(option.key)}
                  style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && !answer && styles.optionPressed]}
                >
                  <View style={[styles.optionIndexHalo, { backgroundColor: optionColor + '12' }]}>
                    <View style={[styles.optionIndex, { backgroundColor: optionColor }]}>
                      <Text style={styles.optionIndexText}>{String.fromCharCode(65 + index)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.optionText, (showCorrect || showWrong) && styles.optionTextStrong]}>{option.label}</Text>
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected, showCorrect && styles.radioCorrect, showWrong && styles.radioWrong]}>
                    {isSelected ? <View style={styles.radioCenter} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          {answer && showAnswerFeedback ? (
            <View accessibilityRole="alert" style={[styles.answerCard, answer.is_correct ? styles.answerCorrect : styles.answerLearn]}>
              <View style={styles.answerToggle}>
                <View style={styles.answerArtwork}>
                  <Image source={answer.is_correct ? PartnerAssets.status.verified : PartnerAssets.actions.policyChecklist} style={styles.answerArtworkImage} resizeMode="contain" />
                </View>
                <Text style={styles.answerTitle}>{answer.is_correct ? 'That’s right.' : 'Here’s the stronger answer.'}</Text>
                <Ionicons name={answer.is_correct ? 'checkmark-circle' : 'information-circle'} size={21} color={answer.is_correct ? '#079D82' : '#6951C7'} />
              </View>
            </View>
          ) : null}

          {!data.answered_today ? (
            <View style={styles.answerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel learning answer"
                accessibilityState={{ disabled: submitting }}
                disabled={submitting}
                onPress={() => router.back()}
                style={({ pressed }) => [styles.cancelButton, submitting && styles.submitButtonDisabled, pressed && styles.submitButtonPressed]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Submit Answer"
                accessibilityState={{ disabled: !selectedOptionKey || submitting }}
                disabled={!selectedOptionKey || submitting}
                onPress={() => void submitAnswer()}
                style={({ pressed }) => [styles.submitButton, (!selectedOptionKey || submitting) && styles.submitButtonDisabled, pressed && styles.submitButtonPressed]}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />}
                <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit Answer"}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.footnote}>
            <Ionicons name="shield-checkmark" size={29} color="#08A58D" />
            <View style={styles.footnoteContent}>
              <Text style={styles.footnoteTitle}>Learning Tip</Text>
              <Text style={styles.footnoteText}>Learning cards are guidance. Coverage and servicing decisions follow the issued policy, insurer process and applicable rules.</Text>
            </View>
            <Ionicons name="megaphone-outline" size={31} color="#76A8EB" />
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Stat({ value, label, icon, iconColor }: { value: number; label: string; icon: 'school' | 'checkbox'; iconColor: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={31} color={iconColor} />
      <View style={styles.statCopy}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  referenceHeader: {
    height: 94,
    marginHorizontal: -partnerTheme.spacing.lg,
    paddingHorizontal: 13,
    backgroundColor: '#07347C',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  headerGlow: { position: 'absolute', left: -45, top: -110, width: 390, height: 200, borderRadius: 160, backgroundColor: '#0958AD', opacity: 0.45 },
  headerCurve: { position: 'absolute', right: -85, bottom: 33, width: 230, height: 135, borderRadius: 115, backgroundColor: '#102B72', opacity: 0.43, transform: [{ rotate: '-18deg' }] },
  headerAction: { width: 43, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  headerArtwork: { width: 70, height: 86 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  referenceTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', letterSpacing: -0.45 },
  headerSubtitle: { color: '#B7CBF5', fontSize: 15, fontWeight: '500', letterSpacing: 0.1 },
  questionSection: { marginTop: 13, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 23, borderWidth: 1, borderColor: '#DDE9FB', shadowColor: '#1559BA', shadowOpacity: 0.1, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  questionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lightbulbCircle: { width: 47, height: 47, borderRadius: 24, backgroundColor: '#E8F3FF', alignItems: 'center', justifyContent: 'center' },
  questionHeadingCopy: { flexShrink: 1 },
  questionMeta: { color: '#0B3882', fontSize: 14, fontWeight: '800', letterSpacing: 0.25 },
  headingUnderline: { width: 110, height: 3, borderRadius: 2, marginTop: 6, backgroundColor: '#135BDB' },
  question: { marginTop: 12, color: '#091F50', fontSize: 18, lineHeight: 25, fontWeight: '700' },
  optionsList: { marginTop: 17, gap: 10 },
  option: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D3DDF0', borderRadius: 21, shadowColor: '#21497A', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  optionSelected: { borderColor: '#2D7BEB', borderWidth: 1.5 },
  optionPressed: { opacity: 0.86 },
  optionIndexHalo: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionIndex: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionIndexText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  optionText: { flex: 1, minWidth: 0, color: '#0B2049', fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  optionTextStrong: { fontWeight: '800' },
  radioOuter: { width: 23, height: 23, borderRadius: 12, borderWidth: 1.8, borderColor: '#8C9DBB', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { backgroundColor: '#1263DF', borderColor: '#1263DF' },
  radioCorrect: { backgroundColor: '#079D82', borderColor: '#079D82' },
  radioWrong: { backgroundColor: '#D54A4A', borderColor: '#D54A4A' },
  radioCenter: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF' },
  inlineError: { marginTop: 9, color: partnerTheme.colors.danger, ...partnerTheme.typography.caption },
  answerCard: { marginTop: 10, borderRadius: partnerTheme.radius.lg, overflow: 'hidden' },
  answerCorrect: { backgroundColor: '#EFF9F3' },
  answerLearn: { backgroundColor: partnerTheme.colors.brandSoft },
  answerToggle: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  answerArtwork: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  answerArtworkImage: { width: 40, height: 40 },
  answerTitle: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  explanationArea: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCD6F1', paddingHorizontal: 13, paddingTop: 11, paddingBottom: 14 },
  explanation: { color: '#4C586D', ...partnerTheme.typography.body },
  statsCard: { marginTop: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 21, paddingVertical: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9FB', shadowColor: '#1559BA', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  statsDivider: { width: 1, height: 38, backgroundColor: '#A8B8D5' },
  statCopy: { flexShrink: 1 },
  statValue: { color: '#081E50', fontSize: 22, lineHeight: 26, fontWeight: '800' },
  statLabel: { color: '#5D7196', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  footnote: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 21, padding: 14, backgroundColor: '#E5F0FF', borderWidth: 1, borderColor: '#D2E4FF' },
  footnoteContent: { flex: 1 },
  footnoteTitle: { color: '#0B4BA9', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  footnoteText: { color: '#315C9A', fontSize: 12.5, lineHeight: 18 },
  answerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 17 },
  cancelButton: { flex: 1, minWidth: 0, minHeight: 57, borderRadius: 30, borderWidth: 1.5, borderColor: '#0756C5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#0756C5', fontSize: 16, fontWeight: '800' },
  submitButton: { flex: 1.6, minWidth: 0, minHeight: 57, borderRadius: 30, backgroundColor: '#0756C5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, shadowColor: '#0756C5', shadowOpacity: 0.25, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonPressed: { opacity: 0.85 },
  submitText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

});
