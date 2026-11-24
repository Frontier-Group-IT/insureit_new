import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

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
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(true);
  const animate = focused && foreground && !reduceMotion;
  const submitLock = useRef(false);
  const [freshResult, setFreshResult] = useState<{key:string;correct:boolean;cardId:string}|null>(null);
  const [data, setData] = useState<PartnerLearningToday | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => { if (live) setReduceMotion(reduced); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active');
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setShowAnswerFeedback(false);
    setSelectedOptionKey(null);
    setFreshResult(null);
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
    if (!data?.card || !selectedOptionKey || data.answered_today || submitting || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPartnerLearningAnswer(data.card.id, selectedOptionKey);
      setFreshResult({ key: selectedOptionKey, correct: result.is_correct, cardId: data.card.id });
      setData(result.today);
      setSelectedOptionKey(null);
      setShowAnswerFeedback(true);
      if (focused && !reduceMotion) void (result.is_correct ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)).catch(() => {});
    } catch {
      setError('Your answer could not be saved. Please try again.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <PartnerScreen title="60-Second Learn" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <View style={styles.referenceHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.headerAction}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <StopwatchArtwork animate={animate} />
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.referenceTitle}>60-Second Learn</Text>
          <MotionEnter animate={animate} delay={110}><Text numberOfLines={1} style={styles.headerSubtitle}>Learn • Practice • Grow</Text></MotionEnter>
        </View>
      </View>
      {loading && !data ? (
        <LearnSkeleton animate={animate} />
      ) : error && !data ? (
        <PartnerStateView state="error" title="Learning is temporarily unavailable" message={error} actionLabel="Try again" onAction={() => void load()} />
      ) : !data?.available || !data.card ? (
        <PartnerStateView state="empty" asset={PartnerAssets.actions.policyChecklist} title="No card scheduled today" message="A new learning card will appear when content is active." />
      ) : (
        <>

          <View style={styles.statsCard}>
            <Stat value={data.stats.attempted_days} label="Learning days" icon="school" iconColor="#1373D7" animate={animate} delay={90} />
            <View style={styles.statsDivider} />
            <Stat value={data.stats.total_attempts} label="Cards completed" icon="checkbox" iconColor="#08A58D" animate={animate} delay={180} completedPulse={Boolean(freshResult && showAnswerFeedback)} />
          </View>

          <MotionEnter animate={animate} delay={180}>
          <View style={styles.questionSection}>
            <QuestionBorderGlow animate={animate} />
            <View style={styles.questionHeadingRow}>
              <BulbArtwork animate={animate} />
              <View style={styles.questionHeadingCopy}>
                <Text style={styles.questionMeta}>TODAY’S QUESTION</Text>
                <UnderlineReveal animate={animate} />
              </View>
            </View>
            <MotionEnter animate={animate} delay={220}><Text style={styles.question}>{data.card.prompt}</Text></MotionEnter>
          </View>
          </MotionEnter>

          <View style={styles.optionsList} accessibilityRole="radiogroup">
            {data.card.options.map((option, index) => {
              const isSelected = (answer?.selected_option_key ?? selectedOptionKey) === option.key;
              const isCorrect = answer?.correct_option_key === option.key;
              const showCorrect = Boolean(answer && isCorrect);
              const showWrong = Boolean(answer && isSelected && !answer.is_correct);
              const optionColor = ['#1256C9', '#079D82', '#F87814', '#8524AF'][index % 4];
              return <QuizOption
                key={option.key}
                index={index}
                label={option.label}
                color={optionColor}
                selected={isSelected}
                correct={showCorrect}
                wrong={showWrong}
                finished={Boolean(data.answered_today)}
                submitting={submitting}
                animate={animate}
                fresh={Boolean(freshResult?.cardId === data.card.id && showAnswerFeedback)}
                onChoose={() => {
                  if (data.answered_today || submitting) return;
                  setSelectedOptionKey(option.key);
                  if (focused && !reduceMotion) void Haptics.selectionAsync().catch(() => {});
                }}
              />;
            })}
          </View>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          {answer && showAnswerFeedback ? (
            <MotionEnter animate={animate} delay={0} style={[styles.answerCard, answer.is_correct ? styles.answerCorrect : styles.answerLearn]} accessibilityRole="alert">
              <View style={styles.answerToggle}>
                <View style={styles.answerArtwork}>
                  <Image source={answer.is_correct ? PartnerAssets.status.verified : PartnerAssets.actions.policyChecklist} style={styles.answerArtworkImage} resizeMode="contain" />
                </View>
                <Text style={styles.answerTitle}>{answer.is_correct ? 'That’s right.' : 'Here’s the stronger answer.'}</Text>
                <Ionicons name={answer.is_correct ? 'checkmark-circle' : 'information-circle'} size={21} color={answer.is_correct ? '#079D82' : '#6951C7'} />
              </View>
            </MotionEnter>
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
              <AnimatedSubmitButton enabled={Boolean(selectedOptionKey && !submitting)} submitting={submitting} animate={animate} onSubmit={() => void submitAnswer()} />
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
    height: 64,
    marginHorizontal: -partnerTheme.spacing.lg,
    paddingHorizontal: 13,
    backgroundColor: '#0A234A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: { width: 32, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerArtwork: { width: 27, height: 33 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  referenceTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.25 },
  headerSubtitle: { color: '#C1D0E7', fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
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
  statsCard: { marginTop: 0, marginHorizontal: -partnerTheme.spacing.lg, flexDirection: 'row', alignItems: 'center', paddingVertical: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DDE9FB' },
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
