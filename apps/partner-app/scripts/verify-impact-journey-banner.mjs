import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../app/impact.tsx',import.meta.url),'utf8');
for(const [fragment,reason] of [
  ["onPress={() => router.push('/journey')}",'Journey navigation remains intact'],
  ['accessibilityLabel="See your journey, milestones and achievements"','Accessible banner action'],
  ["backgroundColor: '#ECECFF'",'Lavender banner background'],
  ["backgroundColor: '#D9DFFF'",'Circular journey icon'],
  ['styles.journeyRoad','Decorative winding road'],
  ['styles.journeyBlueCar','Existing blue car imagery'],
  ['name="location-sharp"','Journey destination pin'],
  ['styles.journeyArrowCircle','Round white arrow action'],
  ['Milestones and achievements','Journey subtitle remains'],
  ['minHeight: 128','Full illustrated banner height'],
]) assert.ok(src.includes(fragment),reason);
assert.ok(!src.includes('<ImpactIcon art="journey" size={46} />'),'Legacy plain journey card removed');
console.log('Reference-style Protection delivered journey banner and navigation verified');
