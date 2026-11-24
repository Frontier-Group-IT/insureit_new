import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle, type StyleProp } from 'react-native';
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
    const app = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
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
                fresh={Boolean(freshResult?.cardId === data.card?.id && showAnswerFeedback)}
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


function useEntrance(animate: boolean, delay = 0) {
  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { fade.setValue(1); rise.setValue(0); return; }
    fade.setValue(0); rise.setValue(8);
    const motion = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 390, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 390, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [animate, delay, fade, rise]);
  return { opacity: fade, transform: [{ translateY: rise }] };
}

function MotionEnter({ animate, delay = 0, children, style, accessibilityRole }: {
  animate: boolean; delay?: number; children: ReactNode; style?: StyleProp<ViewStyle>; accessibilityRole?: 'alert';
}) {
  const entrance = useEntrance(animate, delay);
  return <Animated.View accessibilityRole={accessibilityRole} style={[style, entrance]}>{children}</Animated.View>;
}

function PulseIcon({ animate, children, delay = 0, pulse = false }: {
  animate: boolean; children: ReactNode; delay?: number; pulse?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) { scale.setValue(1); return; }
    scale.setValue(0.87);
    const spring = Animated.spring(scale, { toValue: 1, friction: 9, tension: 82, delay, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [animate, delay, scale]);
  useEffect(() => {
    if (!animate || !pulse) return;
    const bounce = Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, friction: 8, tension: 105, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
    ]);
    bounce.start();
    return () => bounce.stop();
  }, [pulse, animate, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function CountUp({ value, animate, delay = 0, style }: { value: number; animate: boolean; delay?: number; style: TextStyle }) {
  const number = useRef(new Animated.Value(0)).current;
  const [current, setCurrent] = useState(animate ? 0 : value);
  useEffect(() => {
    if (!animate || value === 0) { number.stopAnimation(); number.setValue(value); setCurrent(value); return; }
    number.setValue(0); setCurrent(0);
    let last = -1;
    const listener = number.addListener(({ value: next }) => {
      const rounded = Math.round(next);
      if (last !== rounded) { last = rounded; setCurrent(rounded); }
    });
    const count = Animated.timing(number, { toValue: value, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    count.start(({ finished }) => { if (finished) setCurrent(value); });
    return () => { count.stop(); number.removeListener(listener); };
  }, [number, value, animate, delay]);
  return <Text style={style}>{current.toLocaleString('en-IN')}</Text>;
}

function Stat({ value, label, icon, iconColor, animate, delay, completedPulse = false }: {
  value: number; label: string; icon: 'school' | 'checkbox'; iconColor: string; animate: boolean; delay: number; completedPulse?: boolean;
}) {
  const entrance = useEntrance(animate, delay);
  return (
    <Animated.View style={[styles.stat, entrance]}>
      <PulseIcon animate={animate} delay={delay} pulse={completedPulse}>
        <Ionicons name={icon} size={31} color={iconColor} />
      </PulseIcon>
      <View style={styles.statCopy}>
        <CountUp value={value} style={styles.statValue} animate={animate} delay={delay} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function StopwatchArtwork({ animate }: { animate: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { rotation.setValue(0); return; }
    // A single subtle tick, not an ongoing countdown.
    rotation.setValue(0);
    const motion = Animated.sequence([
      Animated.delay(190),
      Animated.timing(rotation, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    motion.start();
    return () => motion.stop();
  }, [animate, rotation]);
  return <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '7deg'] }) }] }}>
    <Image source={require('../assets/partner/learn-stopwatch-reference.png')} style={styles.headerArtwork} resizeMode="contain" />
  </Animated.View>;
}

function BulbArtwork({ animate }: { animate: boolean }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { glow.setValue(0); return; }
    const sequence = Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [animate, glow]);
  return <View style={styles.lightbulbCircle}>
    <Animated.View pointerEvents="none" style={[styles.bulbGlow, { opacity: glow }]} />
    <Ionicons name="bulb" size={27} color="#0876E9" />
  </View>;
}

function UnderlineReveal({ animate }: { animate: boolean }) {
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) { reveal.setValue(1); return; }
    reveal.setValue(0);
    const transition = Animated.timing(reveal, { toValue: 1, duration: 410, delay: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    transition.start();
    return () => transition.stop();
  }, [animate, reveal]);
  return <View style={styles.headingUnderline}><Animated.View style={[styles.underlineFill, { transform: [{ scaleX: reveal }] }]} /></View>;
}

function QuestionBorderGlow({ animate }: { animate: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { opacity.setValue(0); return; }
    const effect = Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 620, useNativeDriver: true }),
    ]);
    effect.start();
    return () => effect.stop();
  }, [animate, opacity]);
  return <Animated.View pointerEvents="none" style={[styles.questionBorderHighlight, { opacity }]} />;
}

function QuizOption({ index, label, color, selected, correct, wrong, finished, submitting, animate, fresh, onChoose }: {
  index: number; label: string; color: string; selected: boolean; correct: boolean; wrong: boolean;
  finished: boolean; submitting: boolean; animate: boolean; fresh: boolean; onChoose: () => void;
}) {
  const entrance = useEntrance(animate, 245 + index * 80);
  const scale = useRef(new Animated.Value(1)).current;
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const effect = Animated.timing(selection, { toValue: selected ? 1 : 0, duration: animate ? 180 : 0, useNativeDriver: false });
    effect.start();
    return () => effect.stop();
  }, [selected, animate, selection]);
  useEffect(() => {
    if (!(animate && fresh && wrong)) return;
    const effect = Animated.sequence([6, -6, 4, -4, 0].map((toValue) =>
      Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true })));
    effect.start();
    return () => effect.stop();
  }, [animate, fresh, wrong, shake]);
  const press = (active: boolean) => {
    if (!animate) return;
    Animated.spring(scale, { toValue: active ? 0.985 : 1, friction: 9, tension: 100, useNativeDriver: true }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const backgroundColor = selection.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#EFF6FF'] });
  return (
    <Animated.View style={[entrance, { transform: [...entrance.transform, { translateX: shake }, { scale }] }]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={'Answer ' + String.fromCharCode(65 + index) + ': ' + label}
        accessibilityState={{ disabled: Boolean(finished || submitting), checked: Boolean(selected) }}
        disabled={Boolean(finished || submitting)}
        onPress={onChoose}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        style={({ pressed }) => [styles.option, selected && styles.optionSelected, correct && fresh && styles.optionCorrect, wrong && fresh && styles.optionWrong, pressed && !finished && styles.optionPressed]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.optionFill, {
          backgroundColor: correct && fresh ? '#ECF9F0' : wrong && fresh ? '#FFF0F0' : backgroundColor,
        }]} />
        <View style={[styles.optionIndexHalo, { backgroundColor: color + '12' }]}>
          <PulseIcon animate={animate} delay={270 + index * 80}>
            <View style={[styles.optionIndex, { backgroundColor: color }]}>
              <Text style={styles.optionIndexText}>{String.fromCharCode(65 + index)}</Text>
            </View>
          </PulseIcon>
        </View>
        <Text style={[styles.optionText, (correct || wrong) && styles.optionTextStrong]}>{label}</Text>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected, correct && styles.radioCorrect, wrong && styles.radioWrong]}>
          {fresh && correct ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> :
            fresh && wrong ? <Ionicons name="close" size={15} color="#FFFFFF" /> :
            selected ? <View style={styles.radioCenter} /> : null}
        </View>
        {fresh && correct ? <ConfettiBurst animate={animate} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function ConfettiBurst({ animate }: { animate: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    progress.setValue(0);
    const effect = Animated.timing(progress, { toValue: 1, duration: 780, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    effect.start();
    return () => effect.stop();
  }, [animate, progress]);
  if (!animate) return null;
  return <View style={styles.confettiAnchor} pointerEvents="none">
    {['#F7BC39', '#28A790', '#6864E9', '#F57A55', '#58ADF5', '#F5C45E'].map((color, index) => {
      const radians = index * Math.PI / 3;
      return <Animated.View key={index} style={[styles.confettiDot, { backgroundColor: color,
        opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radians) * 38] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * 25] }) },
        ],
      }]} />;
    })}
  </View>;
}

function AnimatedSubmitButton({ enabled, submitting, animate, onSubmit }: {
  enabled: boolean; submitting: boolean; animate: boolean; onSubmit: () => void;
}) {
  const activation = useRef(new Animated.Value(enabled ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const motion = Animated.timing(activation, { toValue: enabled ? 1 : 0, duration: animate ? 230 : 0, useNativeDriver: false });
    motion.start();
    return () => motion.stop();
  }, [activation, enabled, animate]);
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const backgroundColor = activation.interpolate({ inputRange: [0, 1], outputRange: ['#75A4E2', '#0756C5'] });
  return <Animated.View style={[styles.submitButton, { backgroundColor, transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Submit Answer"
      accessibilityState={{ disabled: !enabled || submitting }}
      disabled={!enabled || submitting}
      onPress={onSubmit}
      onPressIn={() => { if (animate) Animated.spring(scale, { toValue: 0.985, friction: 9, useNativeDriver: true }).start(); }}
      onPressOut={() => { if (animate) Animated.spring(scale, { toValue: 1, friction: 9, useNativeDriver: true }).start(); }}
      style={styles.submitButtonInner}>
      {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />}
      <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Answer'}</Text>
    </Pressable>
  </Animated.View>;
}

function LearnSkeleton({ animate }: { animate: boolean }) {
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (!animate) { opacity.setValue(0.75); return; }
    const shimmer = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.6, duration: 650, useNativeDriver: true }),
    ]));
    shimmer.start();
    return () => shimmer.stop();
  }, [animate, opacity]);
  return <View style={styles.loadingSkeleton} accessibilityRole="progressbar" accessibilityLabel="Loading today’s learning card">
    <Animated.View style={[styles.skeletonStats, { opacity }]} />
    <Animated.View style={[styles.skeletonQuestion, { opacity }]} />
    {[0, 1, 2, 3].map((i) => <Animated.View key={i} style={[styles.skeletonOption, { opacity }]} />)}
  </View>;
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
  headingUnderline: { width: 110, height: 3, borderRadius: 2, marginTop: 6, backgroundColor: 'transparent', overflow: 'hidden' },
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
  submitButtonInner: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 30 },
  questionBorderHighlight: { ...StyleSheet.absoluteFillObject, borderColor: '#5DA9FF', borderWidth: 2, borderRadius: 23 },
  bulbGlow: { position: 'absolute', width: 43, height: 43, borderRadius: 22, backgroundColor: '#B2DDFF' },
  underlineFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#135BDB' },
  optionFill: { borderRadius: 20 },
  optionCorrect: { borderColor: '#079D82', backgroundColor: '#ECF9F0' },
  optionWrong: { borderColor: '#D54A4A', backgroundColor: '#FFF0F0' },
  confettiAnchor: { position: 'absolute', right: 22, top: 27, width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  confettiDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
  loadingSkeleton: { gap: 11, paddingTop: 14 },
  skeletonStats: { height: 78, marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#E2ECF9' },
  skeletonQuestion: { height: 150, borderRadius: 23, backgroundColor: '#DCE9FA' },
  skeletonOption: { height: 68, borderRadius: 21, backgroundColor: '#E2ECF9' },

});
