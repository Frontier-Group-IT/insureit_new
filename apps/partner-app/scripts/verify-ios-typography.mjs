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
    ast: true,
    code: true,
    caller: { name: 'partner-typography-check', platform },
    parserOpts: { plugins: ['typescript'] },
    plugins: [plugin],
  });
}

function weightsFor(source, platform) {
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
  visit(transform(source, platform).ast.program);
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
const ios = weightsFor(sample, 'ios');
for (const style of expectedStyles) {
  assert.equal(ios.get(style), '400', 'iOS ' + style + ' must be regular');
}
assert.ok(!ios.has('untouched'), 'Unrelated style declarations must not change');

const sourceWeightValues = {
  heading: '900', display: '800', section: '700', label: '600',
  body: '500', normal: '400', semanticBold: 'bold', computed: '800',
  numeric: '700', quotedKey: 'bolder',
};
for (const platform of ['android', 'web']) {
  const result = weightsFor(sample, platform);
  for (const [style, expected] of Object.entries(sourceWeightValues)) {
    assert.equal(result.get(style), expected, platform + ' ' + style + ' must remain unchanged');
  }
  const output = transform(sample, platform).code;
  assert.match(output, /fontWeight: activeWeight/, platform + ' dynamic values must remain unchanged');
  assert.match(output, /fontWeight: getWeight\(\)/, platform + ' computed values must remain unchanged');
  assert.match(output, /Platform\.OS === ['"]ios['"]/, platform + ' conditional values must remain unchanged');
}

const theme = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
const expectedTheme = {
  display: '800', pageTitle: '800', sectionTitle: '700', cardTitle: '700',
  body: '500', bodyStrong: '700', label: '700', caption: '500',
  meta: '600', eyebrow: '700',
};
for (const [style, original] of Object.entries(expectedTheme)) {
  assert.equal(weightsFor(theme, 'ios').get(style), '400', 'iOS theme ' + style + ' should be regular');
  for (const platform of ['android', 'web']) {
    assert.equal(weightsFor(theme, platform).get(style), original,
      platform + ' theme ' + style + ' should retain original weight');
  }
}
console.log('Partner typography: iOS all fontWeight 400; Android/web originals retained.');
