import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Text, type TextProps } from 'react-native';

const native = Platform.OS !== 'web';
export const IMPACT_REVEAL_MS = 2800;
// One timeline, no auto-advance. Stop and resume at the same elapsed position.
export function useImpactTimeline(active: boolean, paused: boolean) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [reduced, setReduced] = useState<boolean | null>(null);
  const time = useRef(new Animated.Value(IMPACT_REVEAL_MS)).current;
  const ambient = useRef(new Animated.Value(0)).current;
  const elapsed = useRef(0);
  const phase = useRef(0);
  const begun = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true, changed = false;
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (live) setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !changed) setReduced(value); }).catch(() => { if (live && !changed) setReduced(true); });
    return () => { live = false; app.remove(); sub.remove(); };
  }, []);
  useEffect(() => {
    if (!active) {
      begun.current = false; elapsed.current = 0; phase.current = 0; setReady(false);
      time.setValue(IMPACT_REVEAL_MS); ambient.setValue(0); return;
    }
    if (reduced !== false) {
      time.setValue(IMPACT_REVEAL_MS); ambient.setValue(0); setReady(false);
      if (reduced === true) { elapsed.current = IMPACT_REVEAL_MS; begun.current = true; }
      return;
    }
    if (!focused || !foreground || paused) return;
    let live = true;
    if (!begun.current) {
      begun.current = true; elapsed.current = 0; time.setValue(0);
    }
    setReady(true);
    const runAmbient = () => {
      if (!live) return;
      const end = phase.current < 0.5 ? 1 : 0;
      Animated.timing(ambient, { toValue: end, duration: Math.max(1, Math.abs(end - phase.current) * 2600), easing: Easing.linear, useNativeDriver: native, isInteraction: false }).start(({ finished }) => {
        if (finished && live) { phase.current = end; runAmbient(); }
      });
    };
    const remaining = Math.max(0, IMPACT_REVEAL_MS - elapsed.current);
    if (remaining) Animated.timing(time, { toValue: IMPACT_REVEAL_MS, duration: remaining, easing: Easing.linear, useNativeDriver: native, isInteraction: false }).start(({ finished }) => { if (finished && live) { elapsed.current = IMPACT_REVEAL_MS; runAmbient(); } });
    else runAmbient();
    return () => {
      live = false;
      time.stopAnimation(value => { elapsed.current = value; });
      ambient.stopAnimation(value => { phase.current = value; });
    };
  }, [active, paused, focused, foreground, reduced, time, ambient]);
  return { time, ambient, enabled: active && reduced === false && ready };
}
export type ImpactTimeline = ReturnType<typeof useImpactTimeline>;
export function reveal(clock: ImpactTimeline, start: number, end: number, distance = 6, scale = 0.98) {
  const p = clock.time.interpolate({ inputRange: [start, end], outputRange: [0,1], extrapolate: 'clamp' });
  return clock.enabled ? { opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0,1], outputRange: [distance,0] }) }, { scale: p.interpolate({ inputRange: [0,1], outputRange: [scale,1] }) }] } : {};
}
/** Only the small text leaf updates, at most 25 times per second during its reveal. */
export function ImpactCounter({ clock, value, start, duration, format, ...props }: TextProps & { clock: ImpactTimeline; value: number; start: number; duration: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!clock.enabled || !Number.isFinite(value)) { setShown(value); return; }
    let last = -Infinity;
    const update = (ms: number) => {
      const t = Math.max(0, Math.min(1, (ms - start) / duration));
      if (ms - last >= 40 || t === 1 || ms < last) { last = ms; setShown(value * Easing.out(Easing.cubic)(t)); }
    };
    const id = clock.time.addListener(({ value: ms }) => update(ms));
    return () => clock.time.removeListener(id);
  }, [clock.enabled, clock.time, value, start, duration]);
  return <Text {...props} accessibilityLabel={format(value)}>{format(clock.enabled ? shown : value)}</Text>;
}
