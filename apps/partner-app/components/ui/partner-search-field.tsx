import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerSearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search',
  autoFocus = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, focused && styles.focused]}>
      <Ionicons
        name="search-outline"
        size={17}
        color={focused ? partnerTheme.colors.brand : partnerTheme.colors.inkSubtle}
      />
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
        placeholder={placeholder}
        placeholderTextColor={partnerTheme.colors.inkSubtle}
        returnKeyType="search"
        selectionColor={partnerTheme.colors.brand}
        style={styles.input}
      />
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
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: partnerTheme.radius.sm,
    paddingLeft: 11,
    paddingRight: 4,
    backgroundColor: partnerTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focused: {
    backgroundColor: partnerTheme.colors.surface,
    borderColor: partnerTheme.colors.brand,
  },
  input: {
    flex: 1,
    minHeight: 40,
    color: partnerTheme.colors.ink,
    paddingVertical: 0,
    ...partnerTheme.typography.body,
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
