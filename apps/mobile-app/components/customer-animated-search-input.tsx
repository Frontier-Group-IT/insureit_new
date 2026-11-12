import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard, Pressable, Text } from 'react-native';
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
  /** Optional idle prompts that slide upward until the field is focused. */
  idleHints?: string[];
};

export const CustomerAnimatedSearchInput = forwardRef<TextInput, CustomerSearchInputProps>(
  function CustomerAnimatedSearchInput(
    { placeholder, idleHints, value, defaultValue, onFocus, onBlur, style, ...props },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    const hasValue = String(value ?? defaultValue ?? '').length > 0;
    const float = useRef(new Animated.Value(hasValue ? 1 : 0)).current;
    const [reduceMotion, setReduceMotion] = useState(false);
    const [hintIndex, setHintIndex] = useState(0);
    const hintOffset = useRef(new Animated.Value(0)).current;
    // All Customer search inputs animate by default. Explicit hints override the safe generic prompts.
    const hints = idleHints?.length && idleHints.length > 1 ? idleHints : [placeholder, 'Type to search...'];
    const showIdleHints = Boolean(hints && !focused && !hasValue && !reduceMotion);

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

    useEffect(() => {
      if (!showIdleHints || !hints) {
        hintOffset.stopAnimation();
        hintOffset.setValue(0);
        return;
      }

      const interval = setInterval(() => {
        Animated.timing(hintOffset, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setHintIndex((index) => (index + 1) % hints.length);
            hintOffset.setValue(0);
          }
        });
      }, 3000);

      return () => {
        clearInterval(interval);
        hintOffset.stopAnimation();
        hintOffset.setValue(0);
      };
    }, [showIdleHints, hints?.length, hintOffset]);

    return (
      <View style={styles.container}>
        <Animated.Text
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
          numberOfLines={1}
          style={[
            styles.floatingPlaceholder,
            showIdleHints && styles.hiddenFloatingPlaceholder,
            {
              top: float.interpolate({ inputRange: [0, 1], outputRange: [14, 1] }),
              fontSize: float.interpolate({ inputRange: [0, 1], outputRange: [16, 11] }),
            },
          ]}
        >
          {placeholder}
        </Animated.Text>
        {showIdleHints && hints ? (
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no" style={styles.idleHintWindow}>
            <Animated.View style={{ transform: [{ translateY: hintOffset.interpolate({ inputRange: [0, 1], outputRange: [0, -25] }) }] }}>
              <Animated.Text numberOfLines={1} style={styles.idleHint}>{hints[hintIndex % hints.length]}</Animated.Text>
              <Animated.Text numberOfLines={1} style={styles.idleHint}>{hints[(hintIndex + 1) % hints.length]}</Animated.Text>
            </Animated.View>
          </View>
        ) : null}
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
          style={[styles.input, style, styles.consistentText, (focused || hasValue) && styles.floatingInputText]}
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
  hiddenFloatingPlaceholder: { opacity: 0 },
  idleHintWindow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 11,
    height: 25,
    overflow: 'hidden',
    zIndex: 1,
  },
  idleHint: {
    height: 25,
    lineHeight: 25,
    fontSize: CUSTOMER_SEARCH_PLACEHOLDER_SIZE,
    fontWeight: '400',
    color: CUSTOMER_SEARCH_PLACEHOLDER_COLOR,
  },
  input: { width: '100%', minHeight: 46, paddingVertical: 0 },
  consistentText: { fontSize: CUSTOMER_SEARCH_PLACEHOLDER_SIZE, fontWeight: '400' },
  floatingInputText: { paddingTop: 15 },
});

/** Customer-only search bar; do not change shared Staff or Partner search styles. */
export function CustomerSearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  idleHints,
  suggestions,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  idleHints?: string[];
  suggestions?: readonly string[];
}) {
  return (
    <View style={barStyles.suggestionHolder}>
    <View style={barStyles.bar}>
      <MaterialCommunityIcons name="magnify" size={21} color="#0A43A3" />
      <CustomerAnimatedSearchInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        idleHints={idleHints}
        returnKeyType="search"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')}>
          <MaterialCommunityIcons name="close" size={17} color="#7F8EA4" />
        </Pressable>
      ) : null}
    </View>
    {suggestions ? <CustomerSearchSuggestionList value={value} suggestions={suggestions} onSelect={onChangeText} /> : null}
    </View>
  );
}

/** Suggest only loaded/authorized Customer records; tap sets the existing search filter. */
export function CustomerSearchSuggestionList({value,suggestions,onSelect}:{
  value:string;suggestions:readonly string[];onSelect:(value:string)=>void;
}) {
  const [chosen,setChosen] = useState('');
  const query=value.trim().toLowerCase();
  if(query.length<2||value===chosen)return null;
  const seen=new Set<string>();
  const matches=suggestions.filter(item=>{
    const text=item?.trim();const normalized=text?.toLowerCase();
    if(!normalized||seen.has(normalized)||!normalized.includes(query))return false;
    seen.add(normalized);return true;
  }).slice(0,5);
  return <View style={barStyles.suggestions} accessibilityLabel="Search suggestions">
    {matches.length?matches.map(item=><Pressable key={item} accessibilityRole="button"
      accessibilityLabel={`Use suggestion ${item}`} onPress={()=>{
        setChosen(item);onSelect(item);Keyboard.dismiss();
      }} style={barStyles.suggestionRow}><Text numberOfLines={1} style={barStyles.suggestionText}>{item}</Text></Pressable>)
      :<Text style={barStyles.suggestionEmpty}>No matching suggestions</Text>}
  </View>;
}

const barStyles = StyleSheet.create({
  suggestionHolder: { width: '100%', zIndex: 25 },
  suggestions: { marginTop: 3, borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden', elevation: 4 },
  suggestionRow: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E7EDF5' },
  suggestionText: { fontSize: 12, color: '#17365D', fontWeight: '600' },
  suggestionEmpty: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 11, color: '#64748B' },
  bar: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#A9C8EE',
    borderRadius: 16,
    backgroundColor: '#F3F8FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
  },
});
