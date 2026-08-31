import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

export function PartnerEnter({
  children,
  delay = 0,
  distance = 8,
  style,
}: PropsWithChildren<{
  delay?: number;
  distance?: number;
  style?: ViewStyle | ViewStyle[];
}>) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [distance, 0],
            }),
          }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
