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
  const [explanationExpanded, setExplanationExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setExplanationExpanded(false);
    try {
      setData(await getPartnerLearningToday());
    } catch {
      setError('Today’s learning card could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const answer = data?.answer || null;
  async function choose(optionKey: string) {
    if (!data?.card || data.answered_today || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPartnerLearningAnswer(data.card.id, optionKey);
      setData(result.today);
      setExplanationExpanded(false);
    } catch {
      setError('Your answer could not be saved. Please try again.');
    } finally {
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
        <Image source={PartnerAssets.actions.policyChecklist} style={styles.headerArtwork} resizeMode="contain" />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.referenceTitle}>60-Second Learn</Text>
      </View>
      {loading ? (
        <PartnerStateView state="loading" title="Loading today’s learning card" />
      ) : error && !data ? (
        <PartnerStateView state="error" title="Learning is temporarily unavailable" message={error} actionLabel="Try again" onAction={() => void load()} />
      ) : !data?.available || !data.card ? (
        <PartnerStateView state="empty" asset={PartnerAssets.actions.policyChecklist} title="No card scheduled today" message="A new learning card will appear when content is active." />
      ) : (
        <>
          <View style={styles.questionSection}>
            <View style={styles.questionContent}>
              <View style={styles.questionHeadingRow}>
                <Text style={styles.questionMeta}>TODAY’S QUESTION</Text>
                <View style={styles.categoryPill}>
                  <Ionicons name="sparkles-outline" size={14} color={partnerTheme.colors.brand} />
                  <Text style={styles.categoryText}>{data.card.category}</Text>
                </View>
              </View>
              <Text style={styles.question}>{data.card.prompt}</Text>
            </View>
          </View>

          <View style={styles.optionsCard}>
            {data.card.options.map((option, index) => {
              const isSelected = answer?.selected_option_key === option.key;
              const isCorrect = answer?.correct_option_key === option.key;
              const showCorrect = Boolean(answer && isCorrect);
              const showWrong = Boolean(answer && isSelected && !answer.is_correct);
              return (
                <View key={option.key}>
                  {index > 0 ? <View style={styles.optionDivider} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Answer ${String.fromCharCode(65 + index)}: ${option.label}`}
                    accessibilityState={{ disabled: Boolean(data.answered_today || submitting), selected: Boolean(isSelected) }}
                    disabled={Boolean(data.answered_today || submitting)}
                    onPress={() => choose(option.key)}
                    style={[styles.option, showCorrect && styles.optionCorrect, showWrong && styles.optionWrong, isSelected && !answer && styles.optionSelected]}
                  >
                    <View style={[styles.optionIndex, showCorrect && styles.optionIndexCorrect, showWrong && styles.optionIndexWrong]}>
                      {showCorrect ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : showWrong ? <Ionicons name="close" size={14} color="#FFFFFF" /> : <Text style={styles.optionIndexText}>{String.fromCharCode(65 + index)}</Text>}
                    </View>
                    <Text style={[styles.optionText, (showCorrect || showWrong) && styles.optionTextStrong]}>{option.label}</Text>
                    {submitting && !data.answered_today && isSelected ? <ActivityIndicator size="small" color={partnerTheme.colors.brand} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </View>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          {answer ? (
            <View style={[styles.answerCard, answer.is_correct ? styles.answerCorrect : styles.answerLearn]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={answer.is_correct ? 'That’s right. Show explanation' : 'Here’s the stronger answer. Show explanation'}
                accessibilityState={{ expanded: explanationExpanded }}
                onPress={() => setExplanationExpanded((current) => !current)}
                style={styles.answerToggle}
              >
                <View style={styles.answerArtwork}>
                  <Image source={answer.is_correct ? PartnerAssets.status.verified : PartnerAssets.actions.policyChecklist} style={styles.answerArtworkImage} resizeMode="contain" />
                </View>
                <Text style={styles.answerTitle}>{answer.is_correct ? 'That’s right.' : 'Here’s the stronger answer.'}</Text>
                <Ionicons name={explanationExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6951C7" />
              </Pressable>
              {explanationExpanded ? (
                <View style={styles.explanationArea}>
                  <Text style={styles.explanation}>{answer.explanation}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.statsCard}>
            <Stat value={data.stats.attempted_days} label="Learning days" />
            <Stat value={data.stats.total_attempts} label="Cards completed" />
          </View>

          <View style={styles.footnote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={partnerTheme.colors.accent} />
            <Text style={styles.footnoteText}>Learning cards are guidance. Coverage and servicing decisions follow the issued policy, insurer process and applicable rules.</Text>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  referenceHeader: {
    height: 64,
    marginHorizontal: -partnerTheme.spacing.lg,
    paddingHorizontal: 14,
    backgroundColor: '#071E49',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAction: { width: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  headerArtwork: { width: 36, height: 36 },
  referenceTitle: { flexShrink: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  questionSection: { marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  questionContent: { paddingHorizontal: partnerTheme.spacing.lg, paddingTop: 18, paddingBottom: 18 },
  questionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryPill: { minHeight: 30, maxWidth: '48%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, backgroundColor: partnerTheme.colors.brandSoft },
  categoryText: { flexShrink: 1, color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.meta, fontWeight: '800' },
  questionMeta: { flexShrink: 1, color: '#071E49', fontSize: 16, lineHeight: 21, letterSpacing: 0.4, fontWeight: '800' },
  question: { marginTop: 11, color: '#172B51', fontSize: 17, lineHeight: 24, fontWeight: '700' },
  optionsCard: { marginTop: 12, borderRadius: partnerTheme.radius.xl, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: partnerTheme.colors.line },
  optionDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12, backgroundColor: '#E9EDF3' },
  option: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  optionSelected: { backgroundColor: '#F8F7FF' },
  optionCorrect: { backgroundColor: '#F4FBF7' },
  optionWrong: { backgroundColor: '#FFF7F6' },
  optionIndex: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F6' },
  optionIndexCorrect: { backgroundColor: partnerTheme.colors.success },
  optionIndexWrong: { backgroundColor: partnerTheme.colors.danger },
  optionIndexText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta, fontWeight: '800' },
  optionText: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption, fontWeight: '600' },
  optionTextStrong: { fontWeight: '800' },
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
  statsCard: { marginTop: 10, flexDirection: 'row', borderRadius: partnerTheme.radius.lg, paddingVertical: 10, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: partnerTheme.colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  statLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  footnote: { marginTop: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: partnerTheme.radius.md, padding: 10, backgroundColor: partnerTheme.colors.accentSoft },
  footnoteText: { flex: 1, color: '#56716F', ...partnerTheme.typography.caption },
});
