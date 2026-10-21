import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

export function PartnerMotionBadge({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 700, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.04, duration: 700, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [scale]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}
