import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import { partnerTheme } from '@/lib/theme';

const native = Platform.OS !== 'web';
const spring = { stiffness: 210, damping: 23, mass: 0.8, overshootClamping: true, useNativeDriver: native, isInteraction: false } as const;
export function useActivityMotion() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active' || Platform.OS === 'web');
  const [reduced, setReduced] = useState(true);
  const [motionReady, setMotionReady] = useState(false);
  useEffect(() => {
    let live = true, changed = false;
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (live) { setReduced(value); setMotionReady(true); } });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !changed) { setReduced(value); setMotionReady(true); } }).catch(() => { if (live) setMotionReady(true); });
    return () => { live = false; app.remove(); sub.remove(); };
  }, []);
  const visible = focused && foreground;
  return { visible, motionReady, motion: visible && motionReady && !reduced };
}
function useEntrance(motion: boolean, delay = 0) {
  const value = useRef(new Animated.Value(motion ? 0 : 1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion) { value.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    value.setValue(0);
    const animation = Animated.sequence([Animated.delay(delay), Animated.spring(value, { ...spring, toValue: 1 })]);
    animation.start();
    return () => { animation.stop(); value.setValue(1); };
  }, [motion, delay, value]);
  return value;
}
function useLoop(motion: boolean, duration: number) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { value.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
      Animated.delay(900),
    ]));
    animation.start();
    return () => { animation.stop(); value.setValue(0); };
  }, [motion, duration, value]);
  return value;
}
export function MotionCard({ motion, delay = 0, highlight = false, highlightColor = '#3478C5', style, children, ...props }: Omit<PressableProps, 'style' | 'children'> & { motion: boolean; delay?: number; highlight?: boolean; highlightColor?: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const entrance = useEntrance(motion, delay);
  const press = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion || !highlight) { flash.setValue(0); return; }
    flash.setValue(0.22);
    const animation = Animated.timing(flash, { toValue: 0, duration: 1900, useNativeDriver: native, isInteraction: false });
    animation.start();
    return () => { animation.stop(); flash.setValue(0); };
  }, [motion, highlight, flash]);
  useEffect(() => { if (!motion) { press.stopAnimation(); press.setValue(1); } return () => press.stopAnimation(); }, [motion, press]);
  const move = (toValue: number) => { if (motion) Animated.spring(press, { ...spring, toValue }).start(); };
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { scale: press }] }}>
    <Pressable {...props} onPressIn={() => move(0.985)} onPressOut={() => move(1)} style={({ pressed }) => [style, pressed && { opacity: 0.87 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 12, borderWidth: 2, borderColor: highlightColor, backgroundColor: highlightColor, opacity: flash }]} />
      {children}
    </Pressable>
  </Animated.View>;
}

/** Animate only a number already present in the server's exact display string. */
export function MotionNumber({ text, count, currencyOnly = false, motion }: { text: string; count?: number; currencyOnly?: boolean; motion: boolean }) {
  const match = currencyOnly ? /₹\s*([\d,]+(?:\.\d+)?)/.exec(text) : /[\d,]+(?:\.\d+)?/.exec(text);
  const token = currencyOnly ? match?.[1] : match?.[0];
  const target = token ? Number(token.replace(/,/g, '')) : NaN;
  const valid = Number.isFinite(target) && (currencyOnly || count === target);
  const [shown, setShown] = useState(valid && motion ? 0 : target);
  const previous = useRef(valid && motion ? 0 : target);
  useEffect(() => {
    if (!valid || !motion) { previous.current = target; setShown(target); return; }
    const startValue = Number.isFinite(previous.current) ? previous.current : 0;
    if (startValue === target) return;
    let frame = 0, start: number | undefined, last = -Infinity;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / 580);
      if (now - last >= 40 || t === 1) { previous.current = startValue + (target - startValue) * Easing.out(Easing.cubic)(t); setShown(previous.current); last = now; }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, valid, motion]);
  if (!valid || !motion || shown === target || !token) return <>{text}</>;
  const digits = token.includes('.') ? token.split('.')[1].length : 0;
  const display = token.includes(',') ? shown.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : shown.toFixed(digits);
  return <>{text.replace(token, display)}</>;
}

export function ActivityEmpty({ motion, asset, title, message }: { motion: boolean; asset: ImageSourcePropType; title: string; message: string }) {
  const float = useLoop(motion, 1600);
  const entrance = useEntrance(motion);
  return <View style={styles.emptyCard} accessibilityLiveRegion="polite">
    <View style={styles.titleRow}>
      <View style={styles.assetSlot}>
        <Animated.View pointerEvents="none" style={[styles.glow, { opacity: float.interpolate({ inputRange: [0,1], outputRange: [0,0.22] }), transform: [{ scale: float.interpolate({ inputRange: [0,1], outputRange: [0.8,1.12] }) }] }]} />
        {[0,1].map(index => <Animated.View key={index} pointerEvents="none" style={[styles.wave, { right: -index * 4, opacity: float.interpolate({ inputRange: [0,0.45,1], outputRange: [0,0.45,0] }), transform: [{ scale: float.interpolate({ inputRange: [0,1], outputRange: [0.7,1.2] }) }] }]} />)}
        <Animated.Image source={asset} resizeMode="contain" style={[styles.asset, { transform: [{ translateY: float.interpolate({ inputRange: [0,1], outputRange: [0,-3] }) }] }]} />
      </View>
      <Animated.Text style={[styles.title, { opacity: entrance }]}>{title}</Animated.Text>
    </View>
    <Animated.Text style={[styles.message, { opacity: entrance }]}>{message}</Animated.Text>
  </View>;
}
export function ActivitySkeleton({ motion }: { motion: boolean }) {
  const pulse = useLoop(motion, 650);
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading recent activity" style={{ gap: 8 }}>
    {[62,62,54,54].map((height,index) => <View key={index} style={[styles.skeletonCard,{ minHeight: height }]}>
      <Animated.View style={[styles.skeletonIcon,{ opacity: pulse.interpolate({ inputRange:[0,1],outputRange:[0.65,1] }) }]} />
      <View style={{ flex:1,gap:7 }}><Animated.View style={[styles.skeletonLine,{ width:'62%', opacity:pulse.interpolate({ inputRange:[0,1],outputRange:[0.65,1] }) }]} /><Animated.View style={[styles.skeletonLine,{ width:'83%', opacity:pulse.interpolate({ inputRange:[0,1],outputRange:[0.65,1] }) }]} /></View>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  emptyCard: { minHeight: 150, alignItems: 'stretch', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: partnerTheme.spacing.xl, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  assetSlot: { width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center' },
  asset:{width:42,height:42},
  title:{ flexShrink:1, marginTop:0,color:partnerTheme.colors.ink,textAlign:'left',...partnerTheme.typography.cardTitle },
  message:{ marginTop:5,maxWidth:300,color:partnerTheme.colors.inkMuted,textAlign:'center',...partnerTheme.typography.caption,alignSelf:'center' },
  glow:{position:'absolute',width:44,height:44,borderRadius:22,backgroundColor:'#A9D9FF'},
  wave:{position:'absolute',width:18,height:24,borderRightWidth:1.5,borderColor:'#4D9EE9',borderRadius:12},
  skeletonCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E9F3',borderRadius:12,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12},
  skeletonIcon:{width:40,height:40,borderRadius:10,backgroundColor:'#E3EBF7'},
  skeletonLine:{height:8,borderRadius:4,backgroundColor:'#E3EBF7'},
});
