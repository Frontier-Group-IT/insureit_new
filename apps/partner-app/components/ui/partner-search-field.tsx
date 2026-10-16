import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerRotatingSearchPlaceholder({
  placeholders,
  active = true,
  textStyle,
  containerStyle,
}: {
  placeholders: string[];
  active?: boolean;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const items = placeholders.length ? placeholders : ['Search'];
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || items.length < 2) {
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    let cancelled = false;
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) return;
        setIndex((current) => (current + 1) % items.length);
        translateY.setValue(8);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    }, 2800);

    return () => {
      cancelled = true;
      clearInterval(timer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [active, items.length, opacity, translateY]);

  return (
    <View pointerEvents="none" style={[styles.placeholderClip, containerStyle]}>
      <Animated.Text
        numberOfLines={1}
        style={[styles.placeholderText, textStyle, { opacity, transform: [{ translateY }] }]}
      >
        {items[index % items.length]}
      </Animated.Text>
    </View>
  );
}

export function PartnerSearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search',
  placeholders,
  autoFocus = false,
  containerStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  placeholders?: string[];
  autoFocus?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const rotating = !focused && !value && Boolean(placeholders?.length);

  return (
    <View style={[styles.wrap, containerStyle, focused && styles.focused]}>
      <Ionicons
        name="search-outline"
        size={18}
        color={focused ? partnerTheme.colors.brand : '#3156B8'}
      />
      <View style={styles.inputShell}>
        {rotating ? (
          <PartnerRotatingSearchPlaceholder placeholders={placeholders ?? [placeholder]} containerStyle={styles.placeholderOverlay} />
        ) : null}
        <TextInput
          accessibilityLabel={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmit}
          placeholder={rotating ? '' : placeholder}
          placeholderTextColor={partnerTheme.colors.inkSubtle}
          returnKeyType="search"
          selectionColor={partnerTheme.colors.brand}
          style={styles.input}
        />
      </View>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={6}
          onPress={onClear}
          style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
        >
          <Ionicons name="close" size={16} color={partnerTheme.colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DFEA',
  },
  focused: {
    backgroundColor: partnerTheme.colors.surface,
    borderColor: partnerTheme.colors.brand,
  },
  inputShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    color: partnerTheme.colors.ink,
    paddingVertical: 0,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  placeholderClip: {
    flex: 1,
    minWidth: 0,
    height: 20,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderText: {
    color: '#8B95A8',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  clear: {
    width: 36,
    height: 36,
    borderRadius: partnerTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPressed: { backgroundColor: partnerTheme.colors.pressed },
});
