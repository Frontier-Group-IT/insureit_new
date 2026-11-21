/**
 * INSUREIT Partner App typography policy: regular text on iOS, Android and web.
 *
 * This Babel plugin is loaded only by apps/partner-app/babel.config.js.
 * Normalize every local fontWeight style property to 400 at compile time,
 * including conditional and dynamic expressions. Other style properties, APIs,
 * native dependencies and other apps remain untouched.
 */
module.exports = function partnerRegularTypography({ types: t }) {
  return {
    name: 'partner-regular-typography',
    visitor: {
      ObjectProperty(path) {
        const key = path.node.key;
        if (!(t.isIdentifier(key, { name: 'fontWeight' }) ||
          t.isStringLiteral(key, { value: 'fontWeight' }))) return;
        // Replace the whole expression rather than only literals: styles whose
        // weight comes from a variable or Platform.OS must also render regular.
        path.node.value = t.stringLiteral('400');
      },
    },
  };
};
