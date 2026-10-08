import assert from "node:assert/strict";
import sharp from "sharp";
import postcss from "postcss";

assert.equal(sharp.versions.sharp,"0.35.5");
assert.equal(postcss().version,"8.5.24");
const rgba=Buffer.from([255,0,0,255, 0,0,255,255, 0,255,0,255, 255,255,255,255]);
const encoded=await sharp(rgba,{raw:{width:2,height:2,channels:4}}).resize(5,5).png().toBuffer();
const metadata=await sharp(encoded).metadata();
assert.equal(metadata.format,"png");
assert.equal(metadata.width,5);
assert.equal(metadata.height,5);
const output=await postcss([]).process(".a { color: red; }",{from:undefined});
assert.match(output.css,/color:\s*red/);
console.log("PASS Sharp 0.35.5 PNG image transformation and PostCSS 8.5.24 CSS processing");
