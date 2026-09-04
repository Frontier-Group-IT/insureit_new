import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerLearningToday,
  submitPartnerLearningAnswer,
  type PartnerLearningToday,
} from '@/lib/learn';
import { partnerTheme } from '@/lib/theme';

export default function LearnScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerLearningToday | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerLearningToday());
    } catch {
      setError('Today’s learning card could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = data?.answer || null;

  const selectedLabel = useMemo(() => {
    if (!data?.card || !answer) return null;
    return data.card.options.find((option) => option.key === answer.selected_option_key)?.label || null;
  }, [data, answer]);

  async function choose(optionKey: string) {
    if (!data?.card || data.answered_today || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPartnerLearningAnswer(data.card.id, optionKey);
      setData(result.today);
    } catch {
      setError('Your answer could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="60 SEC LEARN"
      title="60-Second Learn"
      onBack={() => router.back()}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading today’s learning card" />
      ) : error && !data ? (
        <PartnerStateView
          state="error"
          title="Learning is temporarily unavailable"
          message={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : !data?.available || !data.card ? (
        <View style={styles.emptyCard}>
          <Ionicons name="book-outline" size={28} color="#9AA3B2" />
          <Text style={styles.emptyTitle}>No card scheduled today</Text>
          <Text style={styles.emptyText}>A new learning card will appear when content is active.</Text>
        </View>
      ) : (
        <>
          <View style={styles.topStrip}>
            <View style={styles.categoryPill}>
              <Ionicons name="sparkles-outline" size={13} color={partnerTheme.colors.brand} />
              <Text style={styles.categoryText}>{data.card.category}</Text>
            </View>
            <View style={styles.streak}>
              <Ionicons name="flame-outline" size={15} color={partnerTheme.colors.warning} />
              <Text style={styles.streakText}>{data.stats.current_streak} day streak</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionMeta}>TODAY’S QUESTION</Text>
            <Text style={styles.question}>{data.card.prompt}</Text>
          </View>

          <View style={styles.options}>
            {data.card.options.map((option, index) => {
              const isSelected = answer?.selected_option_key === option.key;
              const isCorrect = answer?.correct_option_key === option.key;
              const showCorrect = Boolean(answer && isCorrect);
              const showWrong = Boolean(answer && isSelected && !answer.is_correct);

              return (
                <Pressable
                  key={option.key}
                  disabled={Boolean(data.answered_today || submitting)}
                  onPress={() => choose(option.key)}
                  style={[
                    styles.option,
                    showCorrect && styles.optionCorrect,
                    showWrong && styles.optionWrong,
                    isSelected && !answer && styles.optionSelected,
                  ]}
                >
                  <View style={[
                    styles.optionIndex,
                    showCorrect && styles.optionIndexCorrect,
                    showWrong && styles.optionIndexWrong,
                  ]}>
                    {showCorrect ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : showWrong ? (
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.optionIndexText}>{String.fromCharCode(65 + index)}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.optionText,
                    showCorrect && styles.optionTextStrong,
                    showWrong && styles.optionTextStrong,
                  ]}>{option.label}</Text>
                  {submitting && !data.answered_today ? <ActivityIndicator size="small" color={partnerTheme.colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.inlineError}>{error}</Text> : null}

          {answer ? (
            <View style={[styles.answerCard, answer.is_correct ? styles.answerCorrect : styles.answerLearn]}>
              <View style={styles.answerHeader}>
                <View style={[styles.answerIcon, answer.is_correct ? styles.answerIconCorrect : styles.answerIconLearn]}>
                  <Ionicons
                    name={answer.is_correct ? 'checkmark-circle-outline' : 'bulb-outline'}
                    size={20}
                    color={answer.is_correct ? partnerTheme.colors.success : partnerTheme.colors.brand}
                  />
                </View>
                <View style={styles.answerHeaderBody}>
                  <Text style={styles.answerEyebrow}>{answer.is_correct ? 'NICE WORK' : 'GOOD TO KNOW'}</Text>
                  <Text style={styles.answerTitle}>{answer.is_correct ? 'That’s right.' : 'Here’s the stronger answer.'}</Text>
                </View>
              </View>
              {!answer.is_correct && selectedLabel ? (
                <Text style={styles.selectedText}>You selected: {selectedLabel}</Text>
              ) : null}
              <Text style={styles.explanation}>{answer.explanation}</Text>
            </View>
          ) : null}

          <View style={styles.statsCard}>
            <Stat value={data.stats.attempted_days} label="Learning days" />
            <Stat value={data.stats.correct_answers} label="Correct" />
            <Stat value={data.stats.total_attempts} label="Cards completed" />
          </View>

          <View style={styles.footnote}>
            <Ionicons name="shield-checkmark-outline" size={15} color={partnerTheme.colors.accent} />
            <Text style={styles.footnoteText}>Learning cards are guidance. Exact insurance coverage and servicing decisions always follow the issued policy, insurer process and applicable rules.</Text>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: { minHeight: 220, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  emptyText: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 9 },

  topStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryPill: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, backgroundColor: partnerTheme.colors.brandSoft },
  categoryText: { color: partnerTheme.colors.brandStrong, fontSize: 8.5, fontWeight: '800' },
  streak: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#FFF4E5' },
  streakText: { color: '#8A5518', fontSize: 8.5, fontWeight: '800' },

  questionCard: { marginTop: 10, minHeight: 142, justifyContent: 'center', borderRadius: partnerTheme.radius.xl, padding: 15, backgroundColor: partnerTheme.colors.nav },
  questionMeta: { color: '#AAA5FF', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  question: { marginTop: 7, color: '#FFFFFF', fontSize: 20, lineHeight: 28, fontWeight: '800' },

  options: { marginTop: 9, gap: 7 },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 17, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  optionSelected: { borderColor: '#ACA8FA', backgroundColor: '#F8F7FF' },
  optionCorrect: { borderColor: '#B7DEC7', backgroundColor: '#F4FBF7' },
  optionWrong: { borderColor: '#F0C7C2', backgroundColor: '#FFF7F6' },
  optionIndex: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F6' },
  optionIndexCorrect: { backgroundColor: partnerTheme.colors.success },
  optionIndexWrong: { backgroundColor: partnerTheme.colors.danger },
  optionIndexText: { color: partnerTheme.colors.inkMuted, fontSize: 9, fontWeight: '800' },
  optionText: { flex: 1, color: partnerTheme.colors.ink, fontSize: 9.5, lineHeight: 14, fontWeight: '600' },
  optionTextStrong: { fontWeight: '800' },
  inlineError: { marginTop: 9, color: partnerTheme.colors.danger, fontSize: 8.5 },

  answerCard: { marginTop: 10, borderRadius: 18, padding: 13 },
  answerCorrect: { backgroundColor: '#EFF9F3' },
  answerLearn: { backgroundColor: partnerTheme.colors.brandSoft },
  answerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  answerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  answerIconCorrect: { backgroundColor: '#FFFFFF' },
  answerIconLearn: { backgroundColor: '#FFFFFF' },
  answerHeaderBody: { flex: 1 },
  answerEyebrow: { color: partnerTheme.colors.inkMuted, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.8 },
  answerTitle: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '800' },
  selectedText: { marginTop: 8, color: partnerTheme.colors.inkMuted, fontSize: 8.5, lineHeight: 13 },
  explanation: { marginTop: 6, color: '#4C586D', fontSize: 9.5, lineHeight: 15 },

  statsCard: { marginTop: 10, flexDirection: 'row', borderRadius: 17, paddingVertical: 10, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: partnerTheme.colors.ink, fontSize: 15, fontWeight: '800' },
  statLabel: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 7.2, textAlign: 'center' },

  footnote: { marginTop: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 10, backgroundColor: partnerTheme.colors.accentSoft },
  footnoteText: { flex: 1, color: '#56716F', fontSize: 8, lineHeight: 12 },
});
