import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  Text,
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
  suggestions,
  autoFocus = false,
  containerStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  placeholders?: string[];
  suggestions?: readonly string[];
  autoFocus?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const [chosen, setChosen] = useState("");
  useEffect(() => { if (!value.trim()) setChosen(""); }, [value]);
  const searchTerm = value.trim().toLowerCase();
  const seen = new Set<string>();
  const matches = (suggestions || []).filter(item => { const normalized = item?.trim().toLowerCase(); if (!normalized || seen.has(normalized) || !normalized.includes(searchTerm)) return false; seen.add(normalized); return true; }).slice(0, 5);
  const showSuggestions = focused && searchTerm.length >= 2 && value !== chosen && !!suggestions;
  const rotating = !focused && !value;
  const rotatingItems = placeholders?.length ? placeholders : [
    placeholder,
    'Search customer name...',
    'Search vehicle number...',
    'Search policy number...',
  ].filter((item, index, all) => all.indexOf(item) === index);

  return (
    <View style={[styles.wrap, containerStyle, focused && styles.focused]}>
      <Ionicons
        name="search-outline"
        size={21}
        color={focused ? partnerTheme.colors.brand : '#3156B8'}
      />
      <View style={styles.inputShell}>
        {rotating ? (
          <PartnerRotatingSearchPlaceholder placeholders={rotatingItems} containerStyle={styles.placeholderOverlay} />
        ) : null}
        <TextInput
          accessibilityLabel={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onBlur={() => setFocused(false)}
          onChangeText={next => { setChosen(""); onChangeText(next); }}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmit}
          placeholder={rotating ? '' : placeholder}
          placeholderTextColor={partnerTheme.colors.inkSubtle}
          returnKeyType="search"
          selectionColor={partnerTheme.colors.brand}
          style={styles.input}
        />
      </View>
      {showSuggestions ? (
        <View style={styles.suggestionList} accessibilityLabel="Search suggestions">
          {matches.length ? matches.map(item => (
            <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Use suggestion ${item}`}
              onPress={() => { setChosen(item); onChangeText(item); setFocused(false); }}
              style={styles.suggestionRow}>
              <Text numberOfLines={1} style={styles.suggestionText}>{item}</Text>
            </Pressable>
          )) : <Text style={styles.suggestionEmpty}>No matching suggestions</Text>}
        </View>
      ) : null}
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={6}
          onPress={() => {
            setChosen("");
            setFocused(false);
            onChangeText("");
            onClear?.();
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
        >
          <Ionicons name="close" size={16} color={partnerTheme.colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionList: { position: 'absolute', top: 46, left: 0, right: 0, zIndex: 300, backgroundColor: '#FFFFFF', borderColor: '#DCE5EF', borderWidth: 1, borderRadius: 11, overflow: 'hidden', elevation: 12 },
  suggestionRow: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderBottomColor: '#EEF2F6', borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionText: { fontSize: 11, fontWeight: '600', color: '#17365D' },
  suggestionEmpty: { paddingHorizontal: 12, paddingVertical: 11, fontSize: 11, color: '#64748B' },
  wrap: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingLeft: 15,
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
    height: 44,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 44,
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
    height: '100%',
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
