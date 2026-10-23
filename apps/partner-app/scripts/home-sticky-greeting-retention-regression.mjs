import fs from 'node:fs';

const home = fs.readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const screen = fs.readFileSync(new URL('../components/partner-screen.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  home.includes("formatWholeIndianCurrency(rangeData.projected_retention)"),
  'Projected Retention must be formatted without decimal places.',
);
assert(
  screen.includes('stickyHeaderIndices={isHomeHero && !hideTopBar ? [1] : undefined}'),
  'Home sticky header index must remain the greeting/search group.',
);
assert(
  screen.includes('style={styles.homeStickyGreeting}') && screen.includes('{title}'),
  'Greeting must render inside the sticky home search group.',
);
assert(
  !screen.includes('style={styles.homeHeroGreeting}'),
  'Greeting must no longer live inside the scrolling hero.',
);

console.log('Partner Home sticky greeting and retention regression checks passed.');
