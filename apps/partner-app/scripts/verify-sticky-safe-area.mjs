import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync('apps/partner-app/' + path, 'utf8');
const root = read('app/_layout.tsx');
const screen = read('components/partner-screen.tsx');
const policies = read('app/(tabs)/policies.tsx');
const claims = read('app/(tabs)/claims.tsx');

assert.match(root, /import \{ SafeAreaProvider \} from 'react-native-safe-area-context'/);
assert.match(root, /<SafeAreaProvider>[\s\S]*<PartnerErrorBoundary>[\s\S]*<Stack[\s\S]*<\/PartnerErrorBoundary>[\s\S]*<\/SafeAreaProvider>/);
assert.match(screen, /<SafeAreaView style=\{\[styles\.safeArea, navyStatusBar && styles\.navyStatusArea, statusBarColor \? \{ backgroundColor: statusBarColor \} : null\]\} edges=\{\['top'\]\}>/, 'Shared screen must preserve top safe area, navy fallback and opt-in Activity blue.');
assert.match(screen, /statusBarColor \? \{ backgroundColor: statusBarColor \} : null/, 'Per-screen status color must be applied only when explicitly provided.');
for (const file of [policies, claims]) {
  assert.match(file, /<SafeAreaView style=\{styles\.safeArea\} edges=\{\['top'\]\}>/);
}
assert.match(screen, /fixedWhiteHeader: \{[^\n]+top: 0[^\n]+backgroundColor: "#FFFFFF"/);
assert.match(policies, /stickySearchOverlay: \{[^\n]+top: 0[^\n]+backgroundColor: '#082657'/);
assert.match(claims, /stickyOverlay: \{[^\n]+top: 0[^\n]+backgroundColor: "#082657"/);
console.log('Native safe-area provider and navy sticky header contracts passed');
