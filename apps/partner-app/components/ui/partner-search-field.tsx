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
        size={18}
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
          <Ionicons name="close" size={17} color={partnerTheme.colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: partnerTheme.control.fieldHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: partnerTheme.radius.md,
    paddingLeft: 13,
    paddingRight: 5,
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
    minHeight: 44,
    color: partnerTheme.colors.ink,
    paddingVertical: 0,
    ...partnerTheme.typography.body,
  },
  clear: {
    width: 40,
    height: 40,
    borderRadius: partnerTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPressed: { backgroundColor: partnerTheme.colors.pressed },
});
