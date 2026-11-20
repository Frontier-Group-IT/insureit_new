import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugin = require('../plugins/ios-typography.js');

function transform(source, platform) {
  return transformSync(source, {
    filename: 'ios-typography-verification.ts',
    babelrc: false,
    configFile: false,
    caller: { name: 'partner-typography-check', platform },
    parserOpts: { plugins: ['typescript'] },
    plugins: [plugin],
  }).code;
}

const sample = `const styles = {
  heading: { fontWeight: '900' },
  display: { fontWeight: '800' },
  section: { fontWeight: '700' },
  label: { fontWeight: '600' },
  body: { fontWeight: '500' },
  normal: { fontWeight: '400' },
  semanticBold: { fontWeight: 'bold' },
  dynamic: { fontWeight: activeWeight },
  conditional: { fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  computed: { fontWeight: '800' as const },
};`;

const ios = transform(sample, 'ios');
for (const expected of [
  'heading: {\\n    fontWeight: "600"',
  'display: {\\n    fontWeight: "600"',
  'section: {\\n    fontWeight: "600"',
  'label: {\\n    fontWeight: "500"',
  'body: {\\n    fontWeight: "400"',
  'normal: {\\n    fontWeight: "400"',
  'semanticBold: {\\n    fontWeight: "600"',
]) {
  assert.ok(ios.includes(expected), `Missing expected iOS weight: ${expected}`);
}
assert.match(ios, /fontWeight: activeWeight/, 'Dynamic expressions remain intact');
assert.match(ios, /fontWeight: "600" as const/, 'TypeScript const-weight values transform on iOS');

for (const platform of ['android', 'web']) {
  const result = transform(sample, platform);
  for (const weight of ['900', '800', '700', '600', '500', '400', 'bold']) {
    assert.ok(result.includes(`fontWeight: "${weight}"`), `${platform} must keep original weight ${weight}`);
  }
  assert.match(result, /fontWeight: "800" as const/, `${platform} must preserve TS source weights`);
}

const theme = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
const iosTheme = transform(theme, 'ios');
const androidTheme = transform(theme, 'android');
assert.ok(!iosTheme.includes("fontWeight: '800'"), 'iOS theme must not preserve extra-bold headings');
assert.ok(androidTheme.includes("fontWeight: '800'"), 'Android theme must retain original extra-bold headings');

console.log('Partner iOS typography verified: 400/500/600 on iOS, original Android/web weights retained.');
