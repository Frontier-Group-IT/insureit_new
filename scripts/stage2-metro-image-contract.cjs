#!/usr/bin/env node
// Read-only Metro -> image-size contract test. No OTA/native/build artifact.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const root = process.cwd();
const seen = new Set();
for (const app of ['apps/mobile-app','apps/partner-app']) {
  const appRequire = createRequire(path.join(root, app, 'package.json'));
  const metroPackagePath = appRequire.resolve('metro/package.json');
  const metroRequire = createRequire(metroPackagePath);
  const imagePackagePath = metroRequire.resolve('image-size/package.json');
  const info = JSON.parse(fs.readFileSync(imagePackagePath, 'utf8'));
  const resolved = metroRequire.resolve('image-size');
  const imported = metroRequire('image-size');
  const imageSize = imported.imageSize || imported.default || imported;
  assert.equal(typeof imageSize, 'function', 'Metro image-size API must be callable');
  // Well-formed, synthetic one-by-one PNG; no user content.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/eXMAAAAASUVORK5CYII=', 'base64');
  const measured = imageSize(png);
  assert.equal(measured.width, 1, 'PNG width contract');
  assert.equal(measured.height, 1, 'PNG height contract');
  const key = info.version + '@' + imagePackagePath;
  seen.add(key);
  process.stdout.write(JSON.stringify({app, metroPackagePath: path.relative(root, metroPackagePath), imageSize: info.version, packageLocation: path.relative(root, imagePackagePath), pngWidth: measured.width, pngHeight: measured.height}) + '\n');
}
console.log('Metro image-size API baseline PASS; does not establish patched vulnerability or installed-device safety.');
