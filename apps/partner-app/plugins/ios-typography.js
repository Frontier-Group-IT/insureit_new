/**
 * Partner App iOS-only regular typography.
 *
 * The Partner Babel config loads this plugin for all bundles, but only iOS
 * fontWeight style properties are normalized. Android and web are untouched.
 * Keep shared theme tokens and all unrelated styles unchanged.
 */
module.exports = function partnerIosTypography({ types: t }) {
  return {
    name: 'partner-ios-regular-typography',
    visitor: {
      ObjectProperty(path, state) {
        if (state.file.opts.caller?.platform !== 'ios') return;
        const key = path.node.key;
        if (!(t.isIdentifier(key, { name: 'fontWeight' }) ||
          t.isStringLiteral(key, { value: 'fontWeight' }))) return;
        // Override literal, conditional and dynamic expressions for iOS only.
        path.node.value = t.stringLiteral('400');
      },
    },
  };
};
