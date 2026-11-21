/**
 * Partner App iOS typography only.
 *
 * Expo Metro supplies caller.platform. Transform literal fontWeight values only
 * for iOS bundles so Android/web ASTs remain byte-for-byte equivalent for these
 * style properties. No React Native global mutation or native dependency.
 */
module.exports = function partnerIosTypography({ types: t }) {
  function iosWeight(raw) {
    const normalized = String(raw).toLowerCase();
    if (normalized === 'normal') return '400';
    if (normalized === 'bold' || normalized === 'bolder') return '600';
    if (normalized === 'lighter') return '400';
    const weight = Number(normalized);
    if (!Number.isFinite(weight)) return null;
    if (weight >= 700) return '600';
    if (weight >= 600) return '500';
    return '400';
  }

  function adjust(node) {
    if (t.isTSAsExpression(node) || t.isTSTypeAssertion(node)) {
      adjust(node.expression);
    } else if (t.isStringLiteral(node) || t.isNumericLiteral(node)) {
      const adjusted = iosWeight(node.value);
      if (adjusted !== null) node.value = t.isNumericLiteral(node) ? Number(adjusted) : adjusted;
    } else if (t.isConditionalExpression(node)) {
      adjust(node.consequent);
      adjust(node.alternate);
    } else if (t.isLogicalExpression(node)) {
      adjust(node.left);
      adjust(node.right);
    }
  }

  return {
    name: 'partner-ios-lightweight-typography',
    visitor: {
      ObjectProperty(path, state) {
        if (state.file.opts.caller?.platform !== 'ios') return;
        const key = path.node.key;
        if (!(t.isIdentifier(key, { name: 'fontWeight' }) ||
          t.isStringLiteral(key, { value: 'fontWeight' }))) return;
        adjust(path.node.value);
      },
    },
  };
};
