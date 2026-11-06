import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

/** Keep Customer search placeholders consistent with the My Vehicles reference. */
export const CUSTOMER_SEARCH_PLACEHOLDER_COLOR = '#7F8EA4';
export const CUSTOMER_SEARCH_PLACEHOLDER_SIZE = 16;

type CustomerSearchInputProps = TextInputProps & {
  /** Visible hint; becomes a floating label on focus or when a value is entered. */
  placeholder: string;
};

export const CustomerAnimatedSearchInput = forwardRef<TextInput, CustomerSearchInputProps>(
  function CustomerAnimatedSearchInput(
    { placeholder, value, defaultValue, onFocus, onBlur, style, ...props },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    const hasValue = String(value ?? defaultValue ?? '').length > 0;
    const float = useRef(new Animated.Value(hasValue ? 1 : 0)).current;
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
      let alive = true;
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => { if (alive) setReduceMotion(enabled); })
        .catch(() => {});
      return () => { alive = false; };
    }, []);

    useEffect(() => {
      const target = focused || hasValue ? 1 : 0;
      if (reduceMotion) {
        float.setValue(target);
        return;
      }
      const animation = Animated.timing(float, {
        toValue: target,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // top and fontSize are layout properties
      });
      animation.start();
      return () => animation.stop();
    }, [focused, hasValue, reduceMotion, float]);

    return (
      <View style={styles.container}>
        <Animated.Text
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
          numberOfLines={1}
          style={[
            styles.floatingPlaceholder,
            {
              top: float.interpolate({ inputRange: [0, 1], outputRange: [14, 1] }),
              fontSize: float.interpolate({ inputRange: [0, 1], outputRange: [16, 11] }),
            },
          ]}
        >
          {placeholder}
        </Animated.Text>
        <TextInput
          {...props}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          accessibilityLabel={props.accessibilityLabel || placeholder}
          placeholder=""
          placeholderTextColor={CUSTOMER_SEARCH_PLACEHOLDER_COLOR}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, style, styles.consistentText]}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 46, justifyContent: 'center' },
  floatingPlaceholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: CUSTOMER_SEARCH_PLACEHOLDER_COLOR,
    fontWeight: '400',
    zIndex: 1,
  },
  input: { width: '100%', minHeight: 46, paddingVertical: 0 },
  consistentText: { fontSize: CUSTOMER_SEARCH_PLACEHOLDER_SIZE, fontWeight: '400' },
});
