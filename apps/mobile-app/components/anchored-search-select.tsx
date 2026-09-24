import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/theme';

export type AnchoredSearchOption = {
  id: string;
  label: string;
  meta?: string | null;
};

export function AnchoredSearchSelect({
  label,
  selectedId,
  selectedLabel,
  placeholder,
  searchPlaceholder,
  query,
  open,
  options,
  icon,
  onToggle,
  onQueryChange,
  onSelect,
  emptyText = 'No matching options found.',
  autoCapitalize = 'none',
  allowCustomValue = false,
  onCustomValue,
}: {
  label: string;
  selectedId?: string | null;
  selectedLabel?: string | null;
  placeholder: string;
  searchPlaceholder: string;
  query: string;
  open: boolean;
  options: AnchoredSearchOption[];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onToggle: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (option: AnchoredSearchOption) => void;
  emptyText?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  allowCustomValue?: boolean;
  onCustomValue?: (value: string) => void;
}) {
  const anchorRef = useRef<View>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const windowSize = Dimensions.get('window');


  function measureAnchor() {
    requestAnimationFrame(() => {
      anchorRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) setAnchor({ x, y, width, height });
      });
    });
  }

  useEffect(() => {
    if (!open) return;
    measureAnchor();
  }, [open]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function focusSearchInput() {
    requestAnimationFrame(() => {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    });
  }

  function closeSelector() {
    Keyboard.dismiss();
    if (open) onToggle();
  }

  function toggleSelector() {
    if (open) {
      closeSelector();
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setAnchor({ x, y, width, height });
      onToggle();
    });
  }

  const visibleBottom = Math.max(160, windowSize.height - keyboardHeight - 8);
  const belowSpace = Math.max(0, visibleBottom - (anchor.y + anchor.height + 4));
  const aboveSpace = Math.max(0, anchor.y - 8);
  const openBelow = belowSpace >= 180 || belowSpace >= aboveSpace;
  const menuMaxHeight = Math.max(120, Math.min(330, openBelow ? belowSpace : aboveSpace));
  const fallbackWidth = Math.max(220, windowSize.width - 24);
  const menuWidth = anchor.width > 0 ? anchor.width : fallbackWidth;
  const menuLeft = anchor.width > 0 ? Math.min(anchor.x, Math.max(8, windowSize.width - menuWidth - 8)) : 12;
  const menuTop = openBelow
    ? Math.min(anchor.y + anchor.height + 4, Math.max(8, visibleBottom - menuMaxHeight))
    : Math.max(8, anchor.y - menuMaxHeight - 4);
  const customValue = query.trim();
  const hasExactOption = options.some((option) => option.label.trim().toLowerCase() === customValue.toLowerCase());

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View ref={anchorRef} collapsable={false} style={[styles.selectButton, open && styles.selectButtonHidden]}>
        <View style={styles.selectIcon}>
          <MaterialCommunityIcons name={icon} size={18} color="#0A43A3" />
        </View>
        <Text style={[styles.selectValue, !selectedLabel && styles.placeholder]} numberOfLines={1}>
          {selectedLabel || placeholder}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${label.replace(/\s*\*$/, '').toLowerCase()} selector`}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          onPress={toggleSelector}
          style={({ pressed }) => [styles.selectorTrigger, pressed && styles.selectorTriggerPressed]}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={20} color={palette.navy} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSelector}
        onShow={focusSearchInput}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label.replace(/\s*\*$/, '').toLowerCase()} selector`} onPress={closeSelector} style={styles.overlay}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.menu,
              {
                left: menuLeft,
                top: menuTop,
                width: menuWidth,
                maxHeight: menuMaxHeight,
              },
            ]}
          >
            <View style={styles.search}>
              <MaterialCommunityIcons name="magnify" size={19} color="#145ED7" />
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={onQueryChange}
                autoCapitalize={autoCapitalize}
                returnKeyType="search"
                placeholder={searchPlaceholder}
                placeholderTextColor="#6E7F96"
                style={styles.searchInput}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} style={styles.options}>
              {allowCustomValue && customValue && !hasExactOption && onCustomValue ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Keyboard.dismiss();
                    onCustomValue(customValue);
                  }}
                  style={[styles.option, styles.customOption]}
                >
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionText} numberOfLines={1}>Use “{customValue}”</Text>
                    <Text style={styles.optionMeta}>Enter this value manually</Text>
                  </View>
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#0A43A3" />
                </Pressable>
              ) : null}
              {options.length ? options.map((option) => {
                const active = selectedId === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      Keyboard.dismiss();
                      onSelect(option);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>{option.label}</Text>
                      {option.meta ? <Text style={styles.optionMeta} numberOfLines={1}>{option.meta}</Text> : null}
                    </View>
                    {active ? <MaterialCommunityIcons name="check-circle" size={17} color="#0A43A3" /> : null}
                  </Pressable>
                );
              }) : (!allowCustomValue || !customValue ? <Text style={styles.emptyText}>{emptyText}</Text> : null)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 5 },
  fieldLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700', letterSpacing: 0 },
  selectButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectButtonHidden: { opacity: 0 },
  selectIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  selectValue: { flex: 1, color: palette.navy, fontSize: 12.1, fontWeight: '700' },
  placeholder: { color: '#7A8798' },
  selectorTrigger: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  selectorTriggerPressed: { backgroundColor: '#EEF5FF', transform: [{ scale: 0.96 }] },
  overlay: { flex: 1, backgroundColor: 'transparent' },
  menu: { position: 'absolute', maxHeight: 330, borderRadius: 15, borderWidth: 1, borderColor: '#C8D9EF', backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#071D49', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 12 },
  search: { minHeight: 50, margin: 7, borderRadius: 12, borderWidth: 2, borderColor: '#6FA1EA', backgroundColor: '#F0F6FF', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minHeight: 46, color: palette.navy, fontSize: 13, fontWeight: '700' },
  options: { maxHeight: 270 },
  option: { minHeight: 54, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  optionActive: { backgroundColor: '#EEF5FF' },
  customOption: { backgroundColor: '#F8FBFF' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionText: { color: '#607089', fontSize: 12, fontWeight: '800' },
  optionTextActive: { color: palette.navy, fontWeight: '900' },
  optionMeta: { color: '#8A94A6', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  emptyText: { color: '#7A8799', fontSize: 11, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 13 },
});
