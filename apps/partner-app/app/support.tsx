import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerSupport, type PartnerSupport } from '@/lib/engagement';
import { PartnerProfileMenuIcon } from '@/components/ui/partner-profile-menu-icon';

type StatTone = 'warning' | 'info' | 'purple';

export default function SupportScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [reducedMotion, setReducedMotion] = useState(true);
  const animate = focused && foreground && !reducedMotion;
  useEffect(() => {
    let mounted = true;
    const app = AppState.addEventListener('change', next => setForeground(next === 'active'));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value); }).catch(() => {});
    return () => { mounted = false; app.remove(); sub.remove(); };
  }, []);
  const [data, setData] = useState<PartnerSupport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerSupport());
    } catch {
      setError('Support information could not be loaded right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <PartnerScreen title="Support" hideTopBar fullWidth navyStatusBar bottomNavigationNavy
      bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <View style={styles.contentInset}>
        <PartnerCasePageHeader title="Support" icon="headset-outline" onBack={() => router.back()} />
      </View>
      {loading && !data ? (
        <SupportSkeleton animate={animate} />
      ) : error && !data ? (
        <PartnerStateView state="error" title="Support is temporarily unavailable"
          message={error || 'Support information could not be loaded.'}
          actionLabel="Try again" onAction={() => void load()} />
      ) : data ? (
        <View style={styles.page}>
          <View style={styles.hero}>
            <FloatingHeadphones animate={animate} />
            <MotionEntrance animate={animate} delay={40} style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroInformation}>
                  <Text style={[styles.heroTitle, Platform.OS === 'ios' && styles.heroTitleIos]}
                    numberOfLines={Platform.OS === 'ios' ? 1 : 2}
                    adjustsFontSizeToFit={Platform.OS === 'ios'}
                    minimumFontScale={0.75}>INSUREIT Operations Desk</Text>
                  <Text style={styles.heroSubtitle} numberOfLines={2}>Your operational overview</Text>
                </View>
                <View style={styles.heroRight}>
                  <View style={styles.updatedLine}>
                    <TimestampReveal timestamp={data.generated_at} animate={animate} />
                  </View>
                  <View style={styles.heroActions}>
                    <MotionEntrance animate={animate} delay={180} style={styles.heroActionBubble}>
                      <Ionicons name="chatbubble-ellipses" size={18} color="#2681EB" />
                    </MotionEntrance>
                    <MotionEntrance animate={animate} delay={280} style={styles.heroActionBubble}>
                      <Ionicons name="document-text" size={18} color="#1E70D4" />
                    </MotionEntrance>
                  </View>
                </View>
              </View>
            </MotionEntrance>
          </View>

          <View style={styles.contentInset}>
          {data.relationship_contact ? (
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>{initials(data.relationship_contact.name)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>YOUR RELATIONSHIP CONTACT</Text>
                <Text style={styles.contactName}>{data.relationship_contact.name}</Text>
                <Text style={styles.contactMeta}>
                  {[data.relationship_contact.designation, data.relationship_contact.employee_code].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.contactActions}>
                <ContactAction icon="call-outline" label="Call" disabled={!data.relationship_contact.phone}
                  onPress={() => { if (data.relationship_contact?.phone) void Linking.openURL('tel:' + data.relationship_contact.phone); }} />
                <ContactAction icon="mail-outline" label="Email" disabled={!data.relationship_contact.email}
                  onPress={() => { if (data.relationship_contact?.email) void Linking.openURL('mailto:' + data.relationship_contact.email); }} />
              </View>
            </View>
          ) : null}

          <MotionEntrance animate={animate} delay={120} style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Operations Desk</Text>
            <UnderlineMotion animate={animate} />
          </MotionEntrance>

          <View style={styles.statList}>
            <OpsStat value={data.operations.intakes_need_attention}
              label="Need your attention" helper="Items that require your action"
              tone="warning" animate={animate} delay={220} onPress={() => router.push('/policy-intakes')} />
            <OpsStat value={data.operations.intakes_in_progress}
              label="Policy Intakes in progress" helper="Policies currently being processed"
              tone="info" animate={animate} delay={330} onPress={() => router.push('/policy-intakes')} />
            <OpsStat value={data.operations.active_claims}
              label="Active claims" helper="Claims currently in progress"
              tone="purple" animate={animate} delay={440} onPress={() => router.push('/(tabs)/claims')} />
          </View>
          <BottomWaveMotion animate={animate} />
          </View>
        </View>
      ) : null}
    </PartnerScreen>
  );
}

function ContactAction({ icon, label, disabled, onPress }: {
  icon: 'call-outline' | 'mail-outline'; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.contactAction, disabled && styles.disabled]}>
      <Ionicons name={icon} size={17} color="#246AC7" />
    </Pressable>
  );
}


function useSupportEntrance(animate: boolean, delay = 0) {
  const shown = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { opacity.setValue(1); rise.setValue(0); return; }
    if (shown.current) return;
    shown.current = true;
    opacity.setValue(0); rise.setValue(9);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animate, delay, opacity, rise]);
  return { opacity, transform: [{ translateY: rise }] };
}

function MotionEntrance({ animate, delay, style, children }: { animate: boolean; delay?: number; style?: ViewStyle; children: ReactNode }) {
  const entrance = useSupportEntrance(animate, delay);
  return <Animated.View style={[style, entrance]}>{children}</Animated.View>;
}

function FloatingHeadphones({ animate }: { animate: boolean }) {
  const floating = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { floating.stopAnimation(); floating.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floating, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(floating, { toValue: 0, duration: 2300, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, floating]);
  return <View style={styles.heroIconShell}>
    <Animated.View style={[styles.headphoneShadow, {
      opacity: floating.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.055] }),
      transform: [{ scaleX: floating.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }) }],
    }]} pointerEvents="none" />
    <Animated.View style={{ transform: [
      { translateY: floating.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
      { scale: floating.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) },
    ] }}>
      <PartnerProfileMenuIcon kind="support" size={60} />
    </Animated.View>
  </View>;
}

function TimestampReveal({ timestamp, animate }: { timestamp: string; animate: boolean }) {
  const previous = useRef(timestamp);
  const fade = useRef(new Animated.Value(1)).current;
  const tint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (previous.current === timestamp) return;
    previous.current = timestamp;
    if (!animate) { fade.setValue(1); tint.setValue(0); return; }
    fade.setValue(0.45); tint.setValue(1);
    const animation = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(tint, { toValue: 0, duration: 700, useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [timestamp, animate, fade, tint]);
  return <Animated.View style={{ opacity: fade, backgroundColor: tint.interpolate({ inputRange: [0, 1], outputRange: ['transparent', '#DFF2FF'] }), borderRadius: 5 }}>
    <Text style={styles.updatedText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{formatUpdatedAt(timestamp)}</Text>
  </Animated.View>;
}

function UnderlineMotion({ animate }: { animate: boolean }) {
  const grow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) { grow.setValue(1); return; }
    grow.setValue(0);
    const motion = Animated.timing(grow, { toValue: 1, duration: 450, delay: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    motion.start();
    return () => motion.stop();
  }, [animate, grow]);
  return <View style={styles.sectionUnderline}>
    <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#3287EF', transform: [{ scaleX: grow }] }]} />
  </View>;
}

function ActualCount({ value, animate }: { value: number; animate: boolean }) {
  const motion = useRef(new Animated.Value(value)).current;
  const seen = useRef<number | null>(null);
  const played = useRef(false);
  const [displayed, setDisplayed] = useState(value);
  useEffect(() => {
    const initial = seen.current === null;
    const from = !played.current ? 0 : seen.current ?? value;
    seen.current = value;
    if (!animate || !Number.isFinite(value)) {
      motion.setValue(value); setDisplayed(value); return;
    }
    played.current = true;
    if (from === value) {
      motion.setValue(value); setDisplayed(value); return;
    }
    motion.stopAnimation(); motion.setValue(from);
    setDisplayed(from);
    let last = from;
    const subscription = motion.addListener(({ value: next }) => {
      const rounded = Math.round(next);
      if (last !== rounded) { last = rounded; setDisplayed(rounded); }
    });
    const animation = Animated.timing(motion, { toValue: value, duration: initial ? 850 : 600, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished) setDisplayed(value); });
    return () => { animation.stop(); motion.removeListener(subscription); };
  }, [value, animate, motion]);
  return <Text style={styles.countText}>{displayed.toLocaleString('en-IN')}</Text>;
}

function OpsStat({ value, label, helper, onPress, tone, animate, delay }: {
  value: number; label: string; helper: string; onPress: () => void; tone: StatTone; animate: boolean; delay: number;
}) {
  const color = tone === 'warning' ? '#DF284B' : tone === 'info' ? '#176ED6' : '#6B35D8';
  const icon = tone === 'warning' ? 'alert-circle' : tone === 'info' ? 'hourglass' : 'shield-checkmark';
  const entrance = useSupportEntrance(animate, delay);
  const pressScale = useRef(new Animated.Value(1)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const emphasis = useRef(new Animated.Value(0)).current;
  const previous = useRef(value);
  useEffect(() => {
    const was = previous.current;
    previous.current = value;
    if (!animate || value === 0 || (tone === 'warning' && was >= value)) return;
    iconScale.setValue(0.96);
    const sequence = Animated.sequence([
      Animated.spring(iconScale, { toValue: 1.075, friction: 9, tension: 80, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 9, tension: 80, useNativeDriver: true }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [value, tone, animate, iconScale]);
  useEffect(() => {
    if (!animate || tone !== 'warning' || value <= 0) { emphasis.setValue(0); return; }
    emphasis.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(emphasis, { toValue: 1, duration: 270, useNativeDriver: true }),
      Animated.timing(emphasis, { toValue: 0, duration: 430, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [tone, value, animate, emphasis]);
  useEffect(() => {
    if (!animate || tone !== 'info' || value <= 0) { iconRotate.setValue(0); return; }
    const spin = Animated.loop(Animated.sequence([
      Animated.delay(4000),
      Animated.timing(iconRotate, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      Animated.delay(4000),
      Animated.timing(iconRotate, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
    ]));
    spin.start();
    return () => spin.stop();
  }, [tone, value, animate, iconRotate]);
  useEffect(() => () => { pressScale.stopAnimation(); arrow.stopAnimation(); iconScale.stopAnimation(); }, [pressScale, arrow, iconScale]);
  const press = (pressed: boolean) => {
    if (!animate) return;
    Animated.spring(pressScale, { toValue: pressed ? 0.98 : 1, friction: 10, tension: 120, useNativeDriver: true }).start();
    Animated.spring(arrow, { toValue: pressed ? 3 : 0, friction: 10, tension: 120, useNativeDriver: true }).start();
  };
  const rotation = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return <Animated.View style={[entrance, { transform: [...entrance.transform, { scale: pressScale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label + ': ' + value + '. ' + helper}
      accessibilityHint="Opens the related records" onPress={() => { if (animate) void Haptics.selectionAsync().catch(() => {}); onPress(); }}
      onPressIn={() => press(true)} onPressOut={() => press(false)}
      style={({ pressed }) => [styles.statCard, pressed && styles.statPressed]}>
      <View style={[styles.statIconBox, tone === 'warning' ? styles.warningIconBg : tone === 'info' ? styles.infoIconBg : styles.purpleIconBg]}>
        {tone === 'warning' && value > 0 ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.attentionGlow, { opacity: emphasis }]} /> : null}
        <Animated.View style={{ transform: [{ scale: iconScale }, { rotate: tone === 'info' ? rotation : '0deg' }] }}>
          <Ionicons name={icon} size={29} color={color} />
        </Animated.View>
        <View style={[styles.countBubble, { backgroundColor: color }]}>
          <ActualCount value={value} animate={animate} />
        </View>
      </View>
      <View style={[styles.statDivider, { backgroundColor: color }]} />
      <View style={styles.statWords}>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
        <Text style={styles.statHelper} numberOfLines={2}>{helper}</Text>
      </View>
      <View style={styles.arrowCircle}>
        <Animated.View style={{ transform: [{ translateX: arrow }] }}>
          <Ionicons name="chevron-forward" size={21} color={color} />
        </Animated.View>
      </View>
    </Pressable>
  </Animated.View>;
}

function BottomWaveMotion({ animate }: { animate: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) { drift.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 4100, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 4100, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, drift]);
  return <View pointerEvents="none" style={styles.bottomWaveArea}>
    <Animated.View style={[styles.bottomWavePale, { transform: [{ rotate: '5deg' }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) }] }]} />
    <Animated.View style={[styles.bottomWaveBlue, { transform: [{ rotate: '-5deg' }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]} />
    <Animated.View style={[styles.bottomWaveLight, { transform: [{ rotate: '7deg' }, { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }]} />
  </View>;
}

function SupportSkeleton({ animate }: { animate: boolean }) {
  const alpha = useRef(new Animated.Value(0.65)).current;
  useEffect(() => {
    if (!animate) { alpha.setValue(0.8); return; }
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(alpha, { toValue: 0.95, duration: 650, useNativeDriver: true }),
      Animated.timing(alpha, { toValue: 0.55, duration: 650, useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [animate, alpha]);
  return <View style={styles.skeletonScreen} accessibilityRole="progressbar" accessibilityLabel="Loading Support Operations Desk">
    <Animated.View style={[styles.skeletonHero, { opacity: alpha }]} />
    <View style={styles.contentInset}>
      <Animated.View style={[styles.skeletonHeading, { opacity: alpha }]} />
      {[0, 1, 2].map(index => <Animated.View key={index} style={[styles.skeletonCard, { opacity: alpha }]} />)}
    </View>
  </View>;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'IT';
}
function formatUpdatedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Updated recently';
  return 'Updated today · ' + new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(d);
}

const styles = StyleSheet.create({
  page: { paddingBottom: 12, overflow: 'hidden' },
  contentInset: { paddingHorizontal: 16 },
  hero: {
    minHeight: 106, marginHorizontal: 0, borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderColor: '#E1E6EF',
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, overflow: 'hidden',
    shadowColor: '#396CB2', shadowOpacity: 0.09, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  heroIconShell: { height: 60, width: 60, alignItems: 'center', justifyContent: 'center', marginRight: 12, zIndex: 1, transform: [{ translateY: -6 }] },
  heroContent: { flex: 1, minWidth: 0, zIndex: 1 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' },
  heroInformation: { flex: 1, minWidth: 0, minHeight: 60, justifyContent: 'center', transform: [{ translateY: -6 }] },
  heroTitle: { color: '#071B42', fontWeight: '800', fontSize: 12.8, lineHeight: 17 },
  heroTitleIos: { fontSize: 11.2, lineHeight: 15 },
  heroSubtitle: { marginTop: 4, color: '#4E6484', fontSize: 10, lineHeight: 14 },
  heroRight: { flexShrink: 0, width: 100, alignItems: 'flex-end', justifyContent: 'center', gap: 7 },
  updatedLine: { width: '100%', alignItems: 'flex-end' },
  // Optical alignment with the unchanged left title; transform does not move the action icons or header layout.
  updatedText: { color: '#255390', fontSize: 9.2, fontWeight: '700', textAlign: 'right', transform: [{ translateY: 0 }] },
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, zIndex: 1 },
  heroActionBubble: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDEBFF' },
  sectionTitleWrap: { marginTop: 19, marginBottom: 13 },
  sectionTitle: { color: '#071B42', fontWeight: '800', fontSize: 20, letterSpacing: -0.4 },
  sectionUnderline: { marginTop: 5, width: 50, height: 4, borderRadius: 3, backgroundColor: 'transparent', overflow: 'hidden' },
  statList: { gap: 12 },
  statCard: {
    minHeight: 91, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#E3E7EF', overflow: 'hidden', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 11,
    shadowColor: '#617AA4', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  statPressed: { opacity: 0.84 },
  statIconBox: { width: 53, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  warningIconBg: { backgroundColor: '#FBE5F0' }, infoIconBg: { backgroundColor: '#DFECFF' },
  purpleIconBg: { backgroundColor: '#EFE0FF' },
  countBubble: { position: 'absolute', right: -5, top: -7, minWidth: 25, height: 25, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#FFFFFF', elevation: 2 },
  countText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  statDivider: { width: 1, height: 49, marginLeft: 13, marginRight: 13, opacity: 0.6 },
  statWords: { flex: 1, minWidth: 0, zIndex: 1 },
  statLabel: { color: '#071B42', fontSize: 12.6, fontWeight: '800', lineHeight: 17 },
  statHelper: { marginTop: 3, color: '#586A84', fontSize: 10.2, lineHeight: 14 },
  arrowCircle: { marginLeft: 5, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0E5EC', backgroundColor: '#F5F6F8', zIndex: 1 },
  bottomWaveArea: { marginTop: 15, minHeight: 32, overflow: 'hidden' },
  bottomWavePale: { position: 'absolute', width: '140%', height: 66, left: -48, top: 16,
    borderRadius: 95, backgroundColor: '#E6EFFD', transform: [{ rotate: '5deg' }] },
  bottomWaveBlue: { position: 'absolute', width: '120%', height: 66, left: -30, top: 24,
    borderRadius: 95, backgroundColor: '#BED7FF', transform: [{ rotate: '-5deg' }] },
  bottomWaveLight: { position: 'absolute', width: '130%', height: 60, left: -40, top: 30,
    borderRadius: 95, backgroundColor: '#D6E5FF', transform: [{ rotate: '7deg' }] },
  contactCard: { marginTop: 10, padding: 10, backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1,
    borderColor: '#E1E9F6', flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactAvatar: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8E9FF' },
  contactAvatarText: { color: '#2358A2', fontWeight: '800', fontSize: 12 },
  contactInfo: { flex: 1, minWidth: 0 },
  contactLabel: { fontSize: 8, letterSpacing: 0.5, color: '#5D6F8D', fontWeight: '700' },
  contactName: { fontWeight: '800', color: '#10284E', fontSize: 12 },
  contactMeta: { fontSize: 9, color: '#61718A' },
  contactActions: { flexDirection: 'row', gap: 5 },
  contactAction: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EBF4FF',
    alignItems: 'center', justifyContent: 'center' },
  headphoneShadow: { position: 'absolute', width: 36, height: 8, bottom: -4, borderRadius: 12, backgroundColor: '#128E91' },
  attentionGlow: { borderWidth: 1, borderRadius: 16, borderColor: '#DF284B', backgroundColor: '#FFDEE8' },
  skeletonScreen: { paddingTop: 2, gap: 18 },
  skeletonHero: { height: 106, backgroundColor: '#EDF3FA' },
  skeletonHeading: { height: 28, width: 160, borderRadius: 8, marginTop: 7, marginBottom: 14, backgroundColor: '#DFEAF8' },
  skeletonCard: { height: 91, borderRadius: 19, marginBottom: 12, backgroundColor: '#E1EBF8' },
  disabled: { opacity: 0.4 },
});
