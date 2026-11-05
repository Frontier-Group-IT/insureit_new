import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const claim = read('../app/customer/start-claim.tsx');
const policies = read('../app/customer/policies.tsx');

// Short, two-line supporting copy sits immediately below the heading on both platforms.
assert.ok(claim.includes('<Text style={[styles.subtitle, styles.iosSubtitle]} numberOfLines={2}>'));
assert.ok(claim.includes('<Text style={styles.subtitle} numberOfLines={2}>'));
assert.match(claim, /iosSubtitle:\s*\{[^}]*fontSize:\s*11\.5,\s*lineHeight:\s*16/);
assert.ok(claim.includes('Choose the vehicle involved and we’ll use its active policy.'));

// A translucent Android Modal starts at the screen top, unlike measureInWindow.
// Account for the Android status bar when positioning the search BELOW the label.
assert.match(claim, /\bStatusBar\b/);
assert.ok(claim.includes("Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0"));
assert.ok(claim.includes('const menuTop = anchor.y + anchor.height + androidModalStatusBarInset + 4;'));
assert.ok(claim.includes('const viewportBottom = keyboardTop ?? (windowHeight + androidModalStatusBarInset);'));
assert.ok(claim.includes('maxHeight: Math.min(330, availableHeight)'));
assert.ok(claim.includes('anchorRef.current?.measureInWindow((x, y, width, height) => {'));
assert.ok(claim.includes('statusBarTranslucent'));
assert.ok(claim.includes('onRequestClose={closeSelector}'));
assert.ok(claim.includes('onChangeText={onQueryChange}'));

// The model text (right-hand vehicle policy summary) must keep its baseline
// font size; longer names get a trailing ellipsis rather than font shrinking.
assert.ok(policies.includes("tertiaryValue={vehicle?.model ?? '-'}\n                  fixedTertiaryText"));
assert.ok(policies.includes("fixedTertiaryText = false"));
assert.ok(policies.includes("fixedTertiaryText?: boolean;"));
assert.ok(policies.includes('numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit={Platform.OS === \'ios\' && !fixedTertiaryText}'));
assert.match(policies, /summaryTertiary:\s*\{[^}]*fontSize:\s*10\.4/);
assert.ok(policies.includes("tertiaryValue={formatDate(policy.end_date)}"), 'Policy expiry remains separate and unaffected.');

console.log('Customer claim subtitle, Android anchored selector and fixed-size vehicle model regression passed.');
