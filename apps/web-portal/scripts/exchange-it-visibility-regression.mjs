import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const page = read("../app/exchange/listings/page.tsx");
const action = read("../app/exchange/listings/actions.ts");
const badge = read("../app/exchange/listings/listing-visibility-action.tsx");
const migration = read("../../../supabase/migrations/20261017120000_exchange_it_listing_visibility.sql");

assert.ok(page.includes('String(profile.role) === "it_super_user"'));
assert.ok(page.includes('canToggleVisibility ? <th className="px-4 py-3">Action</th> : null'));
assert.ok(page.includes('<ExchangeListingVisibilityAction listingId={row.id} enabled={row.is_enabled} />'));
assert.ok(action.includes('String(profile.role) !== "it_super_user"'));
assert.ok(action.includes('.update({ is_enabled: enabled'));
assert.ok(badge.includes('setExchangeListingVisibility(listingId, next)'));
assert.ok(migration.includes('is_enabled boolean not null default true'));
assert.ok(migration.includes("where l.status = ''live'' and l.is_enabled = true"));
assert.ok(migration.includes('if not v_listing.is_enabled and not public.exchange_is_staff() then'));
console.log("IT Exchange listing visibility regression: OK");
