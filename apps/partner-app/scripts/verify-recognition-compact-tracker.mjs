import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../app/recognition.tsx',import.meta.url),'utf8');
for(const [pattern,label] of [[/RING_SIZE = 50/,'half diameter'],[/RING_RADIUS = 20\.5/,'half radius'],[/width: 3\.7, height: 2\.1/,'half segments'],[/minHeight: 88/,'achievement card compact'],[/minHeight: 100/,'next card compact'],[/minHeight: 49/,'journey action compact'],[/accessibilityRole="progressbar"/,'progress accessibility'],[/next\.current\.toLocaleString/,'count retained'],[/router\.push\('\/journey'\)/,'navigation retained']]) assert.match(source,pattern,label);
console.log('Recognition compact layout and half-sized progress tracker verified');
