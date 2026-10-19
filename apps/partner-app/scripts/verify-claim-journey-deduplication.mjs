import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../app/claim/[id].tsx', import.meta.url)), 'utf8');
assert.match(source, /data\.status_history/);
assert.match(source, /data\.stages/);
assert.match(source, /const seen = new Set<string>\(\)/);
assert.match(source, /item\.title\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)\.toLocaleLowerCase\('en'\)/);
assert.match(source, /seen\.has\(key\)/);
assert.match(source, /if \(item\.kind === 'created'\) return true/);

const build = (rows) => {
  const seen = new Set();
  return rows.sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).filter(item=>{
    if(item.kind==='created') return true;
    const key=item.title.trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
    if(!key||seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const output=build([
  {kind:'stage',title:'Claim Complete',date:'2026-10-19T10:00:00Z'},
  {kind:'status',title:' Claim  Complete ',date:'2026-10-19T09:00:00Z'},
  {kind:'stage',title:'Surveyor Appointed',date:'2026-10-18T12:00:00Z'},
  {kind:'status',title:'surveyor appointed',date:'2026-10-18T11:00:00Z'},
  {kind:'created',title:'Claim recorded',date:'2026-10-17T11:00:00Z'}
]);
assert.deepEqual(output.map(x=>x.title),['Claim recorded','surveyor appointed',' Claim  Complete ']);
console.log('Partner claim journey deduplication passed');
