import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export function StartupSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.52, 0.92],
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Opening InsureIT"
      style={styles.stage}
    >
      <Animated.View style={[styles.content, { opacity }]}>
        <View style={styles.heading} />
        <View style={styles.subheading} />

        <View style={styles.heroCard}>
          <View style={styles.heroBadge} />
          <View style={styles.heroTitle} />
          <View style={styles.heroLine} />
          <View style={styles.heroLineShort} />
        </View>

        <View style={styles.quickRow}>
          <View style={[styles.quickCard, styles.quickCardGap]}>
            <View style={styles.quickIcon} />
            <View style={styles.quickLabel} />
          </View>
          <View style={[styles.quickCard, styles.quickCardGap]}>
            <View style={styles.quickIcon} />
            <View style={styles.quickLabel} />
          </View>
          <View style={[styles.quickCard, styles.quickCardGap]}>
            <View style={styles.quickIcon} />
            <View style={styles.quickLabel} />
          </View>
          <View style={styles.quickCard}>
            <View style={styles.quickIcon} />
            <View style={styles.quickLabel} />
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryTitle} />
            <View style={styles.summaryPill} />
          </View>
          <View style={styles.summaryMetric} />
          <View style={styles.summaryLine} />
          <View style={styles.summaryLineShort} />
        </View>

        <View style={styles.footerCard}>
          <View style={styles.footerIcon} />
          <View style={styles.footerCopy}>
            <View style={styles.footerTitle} />
            <View style={styles.footerLine} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const base = {
  backgroundColor: '#DCE7F2',
};

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    paddingTop: 18,
    paddingBottom: 36,
  },
  content: {
    width: '100%',
  },
  heading: {
    ...base,
    width: '42%',
    height: 22,
    borderRadius: 8,
  },
  subheading: {
    ...base,
    width: '64%',
    height: 11,
    borderRadius: 6,
    marginTop: 10,
  },
  heroCard: {
    marginTop: 24,
    minHeight: 144,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DFE8F1',
  },
  heroBadge: {
    ...base,
    width: 74,
    height: 18,
    borderRadius: 999,
  },
  heroTitle: {
    ...base,
    width: '58%',
    height: 19,
    borderRadius: 7,
    marginTop: 20,
  },
  heroLine: {
    ...base,
    width: '82%',
    height: 10,
    borderRadius: 5,
    marginTop: 12,
  },
  heroLineShort: {
    ...base,
    width: '54%',
    height: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  quickRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  quickCard: {
    flex: 1,
    height: 88,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DFE8F1',
  },
  quickCardGap: {
    marginRight: 10,
  },
  quickIcon: {
    ...base,
    width: 30,
    height: 30,
    borderRadius: 10,
  },
  quickLabel: {
    ...base,
    width: '58%',
    height: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  summaryCard: {
    marginTop: 18,
    minHeight: 148,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DFE8F1',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    ...base,
    width: '34%',
    height: 15,
    borderRadius: 6,
  },
  summaryPill: {
    ...base,
    width: 56,
    height: 20,
    borderRadius: 999,
  },
  summaryMetric: {
    ...base,
    width: '28%',
    height: 27,
    borderRadius: 8,
    marginTop: 22,
  },
  summaryLine: {
    ...base,
    width: '76%',
    height: 9,
    borderRadius: 5,
    marginTop: 15,
  },
  summaryLineShort: {
    ...base,
    width: '48%',
    height: 9,
    borderRadius: 5,
    marginTop: 8,
  },
  footerCard: {
    marginTop: 18,
    minHeight: 88,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FA',
    borderWidth: 1,
    borderColor: '#DFE8F1',
  },
  footerIcon: {
    ...base,
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  footerCopy: {
    flex: 1,
    marginLeft: 14,
  },
  footerTitle: {
    ...base,
    width: '46%',
    height: 13,
    borderRadius: 6,
  },
  footerLine: {
    ...base,
    width: '72%',
    height: 9,
    borderRadius: 5,
    marginTop: 9,
  },
});
