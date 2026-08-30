import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerSearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color="#8A94A6" />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#9AA3B2"
        returnKeyType="search"
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={onClear}
          style={styles.clear}
        >
          <Ionicons name="close-circle" size={20} color="#9AA3B2" />
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
    paddingHorizontal: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  input: { flex: 1, minHeight: 44, color: partnerTheme.colors.ink, ...partnerTheme.typography.body },
  clear: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
