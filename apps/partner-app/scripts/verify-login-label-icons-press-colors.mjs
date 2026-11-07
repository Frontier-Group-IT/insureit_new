import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync('app/login.tsx', 'utf8');
const field = readFileSync('components/ui/partner-field.tsx', 'utf8');
const button = readFileSync('components/ui/partner-button.tsx', 'utf8');

assert.match(screen, /label="Email"\s+labelIcon=\{<MaterialCommunityIcons name="email-outline"/, 'Email icon must sit beside Email label');
assert.match(screen, /label="Password"\s+labelIcon=\{<MaterialCommunityIcons name="lock-outline"/, 'Lock icon must sit beside Password label');
assert.doesNotMatch(screen, /styles\.fieldIcon/, 'No input-overlaid Email or Password icons');
assert.match(field, /<View style=\{styles\.labelRow\}>[\s\S]*\{labelIcon \? <View style=\{styles\.labelIcon\}>\{labelIcon\}<\/View> : null\}[\s\S]*<Text style=\{\[styles\.label/, 'Shared field must render icon alongside label');
assert.match(screen, /paddingLeft: 14, minHeight: 56/, 'Inputs must use normal left padding');
assert.match(screen, /backgroundColor="#0866D9"/, 'Sign-in default must be blue');
assert.match(screen, /pressedBackgroundColor="#082D70"/, 'Sign-in pressed state must be navy');
assert.match(button, /pressed && !blocked && variant === 'primary' && pressedBackgroundColor/, 'Press color must only activate while pressed and enabled');
assert.match(screen, /loading=\{busy\}/, 'Keep loading-state protection');
assert.match(screen, /disabled=\{busy\}/, 'Keep repeat-submit protection');
assert.match(screen, /await signIn\(email, password\)/, 'Preserve existing authentication flow');
assert.match(screen, /accessibilityLabel=\{passwordVisible \? 'Hide password' : 'Show password'\}/, 'Preserve password visibility');
console.log('Partner login field icons and button press-color regression passed');
