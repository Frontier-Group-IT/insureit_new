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

function weightFor(output, style) {
  const match = output.match(new RegExp(String.raw`\\b${style}:\\s*\\{\\s*fontWeight:\\s*['\"]([^'\"]+)['\"]`));
  return match?.[1];
}

const ios = transform(sample, 'ios');
for (const [style, expected] of Object.entries({
  heading: '600', display: '600', section: '600', label: '500',
  body: '400', normal: '400', semanticBold: '600',
})) assert.equal(weightFor(ios, style), expected, `Incorrect iOS weight for ${style}`);
assert.match(ios, /fontWeight: activeWeight/, 'Dynamic font-weight expressions remain intact');
assert.match(ios, /fontWeight:\\s*['\"]600['\"] as const/, 'TypeScript const-weight values transform on iOS');

for (const platform of ['android', 'web']) {
  const output = transform(sample, platform);
  for (const [style, expected] of Object.entries({
    heading: '900', display: '800', section: '700', label: '600',
    body: '500', normal: '400', semanticBold: 'bold',
  })) assert.equal(weightFor(output, style), expected, `${platform} must keep original ${style} weight`);
  assert.match(output, /fontWeight:\\s*['\"]800['\"] as const/, `${platform} must preserve TypeScript weights`);
}

const theme = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
const iosTheme = transform(theme, 'ios');
const androidTheme = transform(theme, 'android');
assert.doesNotMatch(iosTheme, /fontWeight:\\s*['\"](?:700|800|900)['\"]/, 'iOS theme must not retain heavy headings');
assert.match(androidTheme, /fontWeight:\\s*['\"]800['\"]/, 'Android theme must retain original headings');

console.log('Partner iOS typography verified: 400/500/600 on iOS, original Android/web weights retained.');
