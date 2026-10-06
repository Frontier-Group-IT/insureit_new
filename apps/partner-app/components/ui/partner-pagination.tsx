import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';

export function PartnerPagination({
  page,
  totalPages,
  total,
  pageSize,
  rowCount,
  onPrevious,
  onNext,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  rowCount: number;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  if (!rowCount) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(first + rowCount - 1, total);
  const canPrevious = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  return (
    <View style={styles.wrap}>
      <Text style={styles.range}>Showing {first}-{last} of {total}</Text>
      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          disabled={!canPrevious}
          onPress={onPrevious}
          style={({ pressed }) => [styles.button, !canPrevious && styles.buttonDisabled, pressed && canPrevious && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={13} color={canPrevious ? partnerTheme.colors.brand : '#9AA7B8'} />
          <Text style={[styles.buttonText, !canPrevious && styles.buttonTextDisabled]}>Previous</Text>
        </Pressable>
        <Text style={styles.page}>{page} / {Math.max(totalPages, 1)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next page"
          disabled={!canNext}
          onPress={onNext}
          style={({ pressed }) => [styles.button, !canNext && styles.buttonDisabled, pressed && canNext && styles.pressed]}
        >
          <Text style={[styles.buttonText, !canNext && styles.buttonTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={13} color={canNext ? partnerTheme.colors.brand : '#9AA7B8'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 58,
    paddingHorizontal: 4,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  range: { flexShrink: 1, color: '#71819A', fontSize: 9, lineHeight: 12, fontWeight: '600' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  button: {
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D8E2F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  buttonDisabled: { backgroundColor: '#F7F9FC', borderColor: '#E5EAF1' },
  buttonText: { color: partnerTheme.colors.brand, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  buttonTextDisabled: { color: '#9AA7B8' },
  page: { minWidth: 38, textAlign: 'center', color: '#53657D', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
