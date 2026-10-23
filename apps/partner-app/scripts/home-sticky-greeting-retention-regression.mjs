import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const screen = fs.readFileSync(new URL('../components/partner-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  home.includes("formatWholeIndianCurrency(rangeData.projected_retention)"),
  'Projected Retention must display whole rupees without decimals.',
);
assert(
  screen.includes('stickyHeaderIndices={isHomeHero && !hideTopBar ? [1] : undefined}'),
  'Home sticky header index must remain the greeting/search group.',
);
assert(
  screen.includes('style={styles.homeHeroGreeting}') && screen.includes('{title}'),
  'Greeting must render within the hero banner.',
);
assert(
  !screen.includes('style={styles.homeStickyGreeting}'),
  'Greeting must not be attached to the sticky search group.',
);

console.log('Partner Home hero greeting and original retention formatting checks passed.');
