const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, '..', 'dist-web');
const indexPath = path.join(outputDir, 'index.html');
const requiredFiles = [
  'manifest.webmanifest',
  path.join('pwa', 'icon-192.png'),
  path.join('pwa', 'icon-512.png'),
];

for (const file of requiredFiles) {
  const filePath = path.join(outputDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing PWA export file: ${file}`);
  }
}

let html = fs.readFileSync(indexPath, 'utf8');

const headTags = [
  '<meta name="theme-color" content="#061D43" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="InsureIt" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/pwa/icon-192.png" />',
];

const tagsToInsert = headTags.filter((tag) => !html.includes(tag));

if (tagsToInsert.length > 0) {
  html = html.replace('</head>', `\n  ${tagsToInsert.join('\n  ')}\n</head>`);
  fs.writeFileSync(indexPath, html);
}

console.log('Prepared PWA metadata for dist-web.');
