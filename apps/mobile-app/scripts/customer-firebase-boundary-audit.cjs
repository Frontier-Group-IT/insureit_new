// Read-only boundary audit: identify Customer App files that still depend on
// the singleton Supabase Auth/client. This reports, but does not modify files.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const customer = path.join(root, 'app/customer');
const output = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (/\bgetCurrentSession\s*\(|\bsupabase\.(?:from|rpc|storage|auth|channel)\b|\(supabase\s+as\s+any\)/.test(lines[i])) {
          matches.push(i + 1);
        }
      }
      if (matches.length) output.push({ file: path.relative(root,file).replace(/\\/g,'/'), count:matches.length, lines:matches });
    }
  }
}
walk(customer);
output.sort((a,b)=>b.count-a.count || a.file.localeCompare(b.file));
for (const row of output) console.log(`${row.count.toString().padStart(2)} ${row.file} : ${row.lines.join(',')}`);
console.log(`CUSTOMER_FIREBASE_BOUNDARY_AUDIT files=${output.length} references=${output.reduce((n,x)=>n+x.count,0)}`);
