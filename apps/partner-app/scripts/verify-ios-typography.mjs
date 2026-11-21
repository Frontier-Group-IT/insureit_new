import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugin = require('../plugins/ios-typography.js');

function weightsFor(source, platform) {
  const result = transformSync(source, {
    filename: 'partner-typography-verification.ts',
    babelrc: false,
    configFile: false,
    ast: true,
    code: false,
    caller: { name: 'partner-typography-check', platform },
    parserOpts: { plugins: ['typescript'] },
    plugins: [plugin],
  });

  const weights = new Map();
  function visit(node, owner = '') {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, owner);
      return;
    }
    if (node.type === 'ObjectProperty') {
      const key = node.key?.name ?? node.key?.value;
      if (key === 'fontWeight') {
        let value = node.value;
        if (value.type === 'TSAsExpression' || value.type === 'TSTypeAssertion') value = value.expression;
        if (value.type === 'StringLiteral' || value.type === 'NumericLiteral') {
          weights.set(owner, String(value.value));
        }
        return;
      }
      visit(node.value, key);
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'extra', 'start', 'end', 'comments'].includes(key)) continue;
      if (value && typeof value === 'object') visit(value, owner);
    }
  }
  visit(result.ast.program);
  return weights;
}

const sample = [
  "const styles = {",
  "  heading: { fontWeight: '900' },",
  "  display: { fontWeight: '800' },",
  "  section: { fontWeight: '700' },",
  "  label: { fontWeight: '600' },",
  "  body: { fontWeight: '500' },",
  "  normal: { fontWeight: '400' },",
  "  semanticBold: { fontWeight: 'bold' },",
  "  dynamic: { fontWeight: activeWeight },",
  "  conditional: { fontWeight: Platform.OS === 'ios' ? '400' : '700' },",
  "  computed: { fontWeight: '800' as const },",
  "  numeric: { fontWeight: 700 },",
  "  expression: { fontWeight: getWeight() },",
  "  quotedKey: { 'fontWeight': 'bolder' },",
  "  untouched: { fontSize: 14, color: '#123456', fontStyle: 'italic' },",
  "};",
].join('\n');

const expectedStyles = [
  'heading', 'display', 'section', 'label', 'body', 'normal',
  'semanticBold', 'dynamic', 'conditional', 'computed', 'numeric',
  'expression', 'quotedKey',
];

for (const platform of ['ios', 'android', 'web']) {
  const weights = weightsFor(sample, platform);
  for (const style of expectedStyles) {
    assert.equal(weights.get(style), '400', 'Partner ' + platform + ' ' + style + ' must render regular');
  }
  assert.ok(!weights.has('untouched'), platform + ' unrelated styles should remain unchanged');
}

const theme = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
for (const platform of ['ios', 'android', 'web']) {
  const weights = weightsFor(theme, platform);
  for (const style of [
    'display', 'pageTitle', 'sectionTitle', 'cardTitle', 'body',
    'bodyStrong', 'label', 'caption', 'meta', 'eyebrow',
  ]) assert.equal(weights.get(style), '400', 'Shared ' + style + ' must be regular on ' + platform);
}

// Ensure the normalization stays local to the Partner App bundle.
const babelConfig = readFileSync(new URL('../babel.config.js', import.meta.url), 'utf8');
assert.match(babelConfig, /require\('\.\/plugins\/ios-typography'\)/, 'Partner Babel config must load regular typography plugin');

console.log('Partner typography: regular fontWeight 400 verified on iOS, Android and web.');
