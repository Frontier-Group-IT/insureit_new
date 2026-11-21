import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugin = require('../plugins/ios-typography.js');

function weightsFor(source, platform) {
  const result = transformSync(source, {
    filename: 'ios-typography-verification.ts',
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

const ios = weightsFor(sample, 'ios');
for (const [style, expected] of Object.entries({
  heading: '600', display: '600', section: '600', label: '500',
  body: '400', normal: '400', semanticBold: '600', computed: '600',
})) assert.equal(ios.get(style), expected, `Incorrect iOS weight for ${style}`);
assert.ok(!ios.has('dynamic'), 'Dynamic font-weight expressions must remain unmodified');

for (const platform of ['android', 'web']) {
  const result = weightsFor(sample, platform);
  for (const [style, expected] of Object.entries({
    heading: '900', display: '800', section: '700', label: '600',
    body: '500', normal: '400', semanticBold: 'bold', computed: '800',
  })) assert.equal(result.get(style), expected, `${platform} must retain ${style}`);
}

const theme = readFileSync(new URL('../lib/theme.ts', import.meta.url), 'utf8');
assert.equal(weightsFor(theme, 'ios').get('display'), '600', 'iOS display should be semibold');
assert.equal(weightsFor(theme, 'ios').get('body'), '400', 'iOS body should be regular');
assert.equal(weightsFor(theme, 'android').get('display'), '800', 'Android headings must not change');
console.log('Partner typography: iOS 400/500/600, Android/web original weights verified.');
