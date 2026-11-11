import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync('app/login.tsx', 'utf8');
const field = readFileSync('components/ui/partner-field.tsx', 'utf8');
const button = readFileSync('components/ui/partner-button.tsx', 'utf8');

assert.match(screen, /label="Email"\s+leftAccessory=\{<MaterialCommunityIcons name="email-outline"/, 'Email must have a visible label above its input while retaining the inside-field email icon');
assert.match(screen, /label="Password"\s+leftAccessory=\{<MaterialCommunityIcons name="lock-outline"/, 'Password must have a visible label above its input while retaining the inside-field lock icon');
assert.doesNotMatch(screen, /labelIcon=|styles\.fieldIcon|hideLabel/, 'Login labels must stay visible and field icons remain inside inputs');
assert.match(field, /\{!hideLabel \? \(/, 'Visual labels must be optionally hidden while retaining accessibility labels');
assert.match(field, /accessibilityLabel=\{inputProps\.accessibilityLabel \|\| label\}/, 'Hidden labels still name inputs for accessibility');
assert.match(field, /styles\.inputWithLeftAccessory/, 'Inputs must reserve text space for leading icon');
assert.match(field, /pointerEvents="none" style=\{styles\.leftAccessory\}/, 'Decorative icon must not intercept input touches');
assert.match(field, /inputWithLeftAccessory: \{ paddingLeft: 52 \}/, 'Input text must not overlap icon');
assert.match(field, /\{rightAccessory \? <View style=\{styles\.rightAccessory\}/, 'Password visibility control must remain inside the input');
assert.match(screen, /backgroundColor="#0866D9"/, 'Sign-in default must be blue');
assert.match(screen, /pressedBackgroundColor="#082D70"/, 'Sign-in pressed state must be navy');
assert.match(button, /pressed && !blocked && variant === 'primary' && pressedBackgroundColor/, 'Press color must only activate while pressed and enabled');
assert.match(screen, /loading=\{busy\}/, 'Keep loading-state protection');
assert.match(screen, /disabled=\{busy\}/, 'Keep repeat-submit protection');
assert.match(screen, /await signIn\(email, password\)/, 'Preserve existing authentication flow');
assert.match(screen, /accessibilityLabel=\{passwordVisible \? 'Hide password' : 'Show password'\}/, 'Preserve password visibility');
console.log('Partner login visible labels, inside-field icons and button press-color regression passed');
