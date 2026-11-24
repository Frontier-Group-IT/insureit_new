import ts from 'typescript';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../app/recognition.tsx',import.meta.url),'utf8');
for(const [pattern,label] of [[/RING_SIZE = 50/,'half diameter'],[/RING_RADIUS = 20\.5/,'half radius'],[/width: 3\.7, height: 2\.1/,'half segments'],[/minHeight: 88/,'achievement card compact'],[/minHeight: 100/,'next card compact'],[/minHeight: 49/,'journey action compact'],[/accessibilityRole="progressbar"/,'progress accessibility'],[/value=\{next\.current\}/,'count retained'],[/router\.push\('\/journey'\)/,'navigation retained']]) assert.match(source,pattern,label);
console.log('Recognition compact layout and half-sized progress tracker verified');

const historySource = readFileSync(new URL('../lib/recognition-motion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(historySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reconcileRecognitionHistory } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const first = reconcileRecognitionHistory(null, ['first']);
assert.deepEqual(first.newlyUnlocked, [], 'Existing achievements never celebrate on first visit');
assert.deepEqual(JSON.parse(first.persisted), ['first']);
const added = reconcileRecognitionHistory(first.persisted, ['first','second','second']);
assert.deepEqual(added.newlyUnlocked, ['second'], 'Only newly observed achievement celebrates once');
assert.equal(added.shouldWrite, true);
assert.deepEqual(reconcileRecognitionHistory(added.persisted, ['first','second']).newlyUnlocked, []);
assert.equal(reconcileRecognitionHistory(added.persisted, ['first']).shouldWrite, false);
assert.deepEqual(reconcileRecognitionHistory(added.persisted, ['second']).newlyUnlocked, [], 'Previously seen achievement never re-celebrates');
for (const bad of ['broken', '{}', '[1]']) {
  const baseline = reconcileRecognitionHistory(bad, ['first']);
  assert.deepEqual(baseline.newlyUnlocked, []);
  assert.equal(baseline.shouldWrite, true);
}
assert.deepEqual(reconcileRecognitionHistory('[]', ['first']).newlyUnlocked, ['first'], 'A real new unlock after an empty baseline celebrates');
for (const [pattern,label] of [
  [/useIsFocused\(\)/,'screen focus gates motion'],
  [/AppState.addEventListener\('change'/,'background lifecycle gates motion'],
  [/AccessibilityInfo.isReduceMotionEnabled\(\)/,'reduced motion preference'],
  [/reduceMotionChanged/,'live reduced motion changes'],
  [/partner:recognition-seen:v1:/,'account-local history'],
  [/Haptics.NotificationFeedbackType.Success/,'new unlock haptic'],
  [/Haptics.ImpactFeedbackStyle.Light/,'journey touch haptic'],
  [/Animated.spring/,'spring motion'],
  [/Math.min\(index, 8\) \* 100/,'100ms bounded stagger'],
  [/Animated.delay\(5100\)/,'six-second shimmer cycle'],
  [/duration: 900/,'six-second shimmer sweep'],
  [/animation.stop\(\)/,'motion cancellation'],
  [/cancelAnimationFrame\(frame\)/,'count animation cleanup'],
  [/Math.min\(1, next.current \/ next.target\)/,'real milestone ratio'],
  [/styles.earnedPill/,'achievement badge'],
  [/RING_COLORS\[index\]/,'purple ring gradient'],
]) assert.match(source, pattern, label);
assert.doesNotMatch(source, /from ['"](?:react-native-reanimated|react-native-svg|expo-linear-gradient|lottie-react-native)['"]/, 'No new native modules in runtime 0.2.0');
console.log('Recognition animation lifecycle, new-unlock deduplication and OTA-safe native dependencies verified');
