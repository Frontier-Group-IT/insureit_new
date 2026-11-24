import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

/** Stack-screen companion to the permission-gated Home tab bar. */
export function PartnerCaseBottomNavigation({ activeTab, animateSelection = false }: { activeTab?: 'Home' | 'Business' | 'Policies' | 'Claims' | 'More'; animateSelection?: boolean } = {}) {
  const router = useRouter();
  const { context } = usePartnerSession();
  const items = [
    { label: 'Home', route: '/(tabs)', icon: 'home-outline', allowed: canPartnerAccess(context, 'view_dashboard') },
    { label: 'Business', route: '/(tabs)/business', icon: 'briefcase-outline', allowed: canPartnerAccess(context, 'view_dashboard') },
    { label: 'Policies', route: '/(tabs)/policies', icon: 'document-text-outline', allowed: canPartnerAccess(context, 'view_policies') },
    { label: 'Claims', route: '/(tabs)/claims', icon: 'shield-outline', allowed: canPartnerAccess(context, 'view_claims') },
    { label: 'More', route: '/(tabs)/more', icon: 'grid-outline', allowed: true },
  ] as const;
  const visibleItems = items.filter(item => item.allowed);
  const activeIndex = visibleItems.findIndex(item => item.label === activeTab);
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(true);
  const position = useRef(new Animated.Value(activeIndex)).current;
  const [preview, setPreview] = useState(activeIndex);
  const enabled = animateSelection && !reduced && width > 0 && activeIndex >= 0;
  useEffect(() => {
    if (!animateSelection) return;
    let live = true;
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { if (live) setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    return () => { live = false; sub.remove(); };
  }, [animateSelection]);
  useFocusEffect(useCallback(() => {
    position.stopAnimation();
    position.setValue(activeIndex);
    setPreview(activeIndex);
    return () => position.stopAnimation();
  }, [activeIndex, position]));
  useEffect(() => {
    if (!enabled) { position.stopAnimation(); position.setValue(activeIndex); setPreview(activeIndex); }
  }, [enabled, activeIndex, position]);
  const moveTo = (index: number, duration: number) => {
    if (!enabled) return;
    setPreview(index);
    Animated.timing(position, { toValue: index, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false }).start();
  };
  const itemWidth = width / visibleItems.length;
  return (
    <View style={styles.bar} onLayout={animateSelection ? event => setWidth(event.nativeEvent.layout.width) : undefined}>
      {enabled ? <Animated.View pointerEvents="none" style={[styles.movingPill, { left: (itemWidth - 44) / 2, transform: [{ translateX: Animated.multiply(position, itemWidth) }] }]} /> : null}
      {visibleItems.map((item, index) => (
        <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label}
          onPressIn={() => moveTo(index, 160)} onPressOut={() => moveTo(activeIndex, 160)}
          onPress={() => { moveTo(index, 280); router.navigate(item.route as never); }} style={styles.item}
          accessibilityState={{ selected: activeTab === item.label }}>
          <View style={[styles.iconWrap, !enabled && activeTab === item.label && styles.iconWrapActive]}>
            {enabled ? <Animated.View style={{ transform: [{ scale: position.interpolate({ inputRange: [index - 1, index, index + 1], outputRange: [1, 1.2, 1], extrapolate: 'clamp' }) }] }}><Ionicons name={item.icon} color={preview === index ? '#FFFFFF' : '#AFC1DE'} size={20} /></Animated.View> : <Ionicons name={item.icon} color={activeTab === item.label ? '#FFFFFF' : '#AFC1DE'} size={activeTab === item.label ? 24 : 20} />}
          </View>
          <Text style={[styles.label, (enabled ? preview === index : activeTab === item.label) && styles.activeLabel]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { minHeight: 57, flexDirection: 'row', backgroundColor: '#071E49', borderTopColor: '#173968', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 5, paddingBottom: 7 },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 44, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  movingPill: { position: 'absolute', top: 5 + StyleSheet.hairlineWidth, width: 44, height: 31, borderRadius: 16, backgroundColor: '#203F79' },
  iconWrapActive: { backgroundColor: '#203F79' },
  activeLabel: { color: '#FFFFFF' },
  label: { color: '#AFC1DE', fontSize: 9.25, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
});
