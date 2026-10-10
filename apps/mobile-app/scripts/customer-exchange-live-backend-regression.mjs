import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const screenPath = path.join(root, 'apps/mobile-app/app/customer/exchange.tsx');
const detailPath = path.join(root, 'apps/mobile-app/app/customer/exchange/[listingId].tsx');
const searchPath = path.join(root, 'apps/mobile-app/app/customer/exchange/search.tsx');
const healthPath = path.join(root, 'apps/mobile-app/app/customer/exchange/health.tsx');
const comparePath = path.join(root, 'apps/mobile-app/app/customer/exchange/compare.tsx');
const financePath = path.join(root, 'apps/mobile-app/app/customer/exchange/finance.tsx');
const addVehiclePath = path.join(root, 'apps/mobile-app/app/customer/add-vehicle.tsx');
const dealPath = path.join(root, 'apps/mobile-app/app/customer/exchange/deal.tsx');
const homePath = path.join(root, 'apps/mobile-app/components/exchange/ExchangeMarketplaceHome.tsx');
const sellPath = path.join(root, 'apps/mobile-app/components/exchange/ExchangeSellJourney.tsx');
const activityPath = path.join(root, 'apps/mobile-app/components/exchange/ExchangeActivityCenter.tsx');
const offerReviewPath = path.join(root, 'apps/mobile-app/components/exchange/ExchangeOfferReviewSheet.tsx');
const servicePath = path.join(root, 'apps/mobile-app/lib/exchange.ts');
const migrationPath = path.join(root, 'supabase/migrations/20261007125600_customer_exchange_selling_modes.sql');

const screen = fs.readFileSync(screenPath, 'utf8');
const detail = fs.readFileSync(detailPath, 'utf8');
const search = fs.readFileSync(searchPath, 'utf8');
const health = fs.readFileSync(healthPath, 'utf8');
const compare = fs.readFileSync(comparePath, 'utf8');
const finance = fs.readFileSync(financePath, 'utf8');
const addVehicle = fs.readFileSync(addVehiclePath, 'utf8');
const deal = fs.readFileSync(dealPath, 'utf8');
const home = fs.readFileSync(homePath, 'utf8');
const sell = fs.readFileSync(sellPath, 'utf8');
const activity = fs.readFileSync(activityPath, 'utf8');
const offerReview = fs.readFileSync(offerReviewPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const appSource = [screen, detail, search, health, deal, home, sell, activity, offerReview].join('\n');
const locationContracts = [
  [home, "from('india_locations')", 'independent India location master lookup'],
  [home, "ilike('search_text'", 'city district state PIN search'],
  [home, "locationSearchLoading", 'debounced location search loading feedback'],
  [screen, "setSelectedLocation(selected)", 'GPS city selection independent of inventory'],
  [screen, "listingCity === desiredCity", 'city match tolerates state abbreviation differences'],
];
for (const [source, needle, label] of locationContracts) {
  if (!source.includes(needle)) throw new Error('Customer Exchange missing ' + label);
}
if (screen.includes("Alert.alert('No nearby listings'")) throw new Error('GPS must not require active listing in exact current city');


const requiredAppContracts = [
  'getSelectedCustomerContext',
  'getExchangeMarketplaceFeed',
  'getExchangeSellableVehicles',
  'getExchangeActivity',
  'toggleExchangeFavorite',
  'placeExchangeBid',
  'requestExchangeContact',
  'saveExchangeListingDraft',
  'submitExchangeListing',
  'getExchangeSellerBidBook',
  'acceptExchangeLeadingBid',
  'respondExchangeContactRequest',
  'confirmExchangeDeal',
  'uploadExchangePhoto',
  'requestMediaLibraryPermissionsAsync',
  'requestCameraPermissionsAsync',
  'launchImageLibraryAsync',
  'launchCameraAsync',
  'Submit for review',
];

for (const contract of requiredAppContracts) {
  if (!appSource.includes(contract)) {
    throw new Error(`Customer Exchange live-backend contract missing: ${contract}`);
  }
}

const requiredArchitectureContracts = [
  [screen, 'ExchangeMarketplaceHome', 'marketplace home component'],
  [screen, 'ExchangeSellJourney', 'guided seller component'],
  [screen, 'overall_condition', 'seller condition persistence'],
  [screen, 'seller_declared', 'seller declaration persistence'],
  [screen, 'ExchangeActivityCenter', 'My Exchange transaction center'],
  [screen, 'ExchangeOfferReviewSheet', 'seller offer review sheet'],
  [offerReview, 'Accept best offer', 'private-offer acceptance UX'],
  [offerReview, 'Reject offer', 'private-offer rejection UX'],
  [activity, 'WITHDRAW', 'buyer private-offer withdrawal UX'],
  [offerReview, 'Accept leading bid', 'managed-auction acceptance UX'],
  [activity, "'buying'", 'Buying activity tab'],
  [activity, "'selling'", 'Selling activity tab'],
  [activity, "'saved'", 'Saved activity tab'],
  [activity, "'deals'", 'Deals activity tab'],
  [screen, "/customer/exchange/search", 'dedicated inventory search route'],
  [search, 'getExchangeMarketplaceFeed', 'search live marketplace feed'],
  [search, 'toggleExchangeFavorite', 'search favorite action'],
  [search, "/customer/exchange/[listingId]", 'search detail navigation'],
  [detail, "/customer/exchange/health", 'vehicle health report navigation'],
  [health, 'getExchangeListingDetail', 'health report authoritative RPC'],
  [health, 'AuthBridge verification', 'health report verification source'],
  [health, 'Challan data is not currently connected', 'health report unsupported-data disclosure'],
  [search, "/customer/exchange/compare", 'comparison navigation from search'],
  [compare, 'getExchangeMarketplaceFeed', 'comparison live marketplace data'],
  [compare, 'getExchangeListingDetail', 'comparison authoritative detail data'],
  [compare, 'Commercial specifications', 'commercial comparison section'],
  [compare, 'Health & compliance', 'health comparison section'],
  [detail, "/customer/exchange/finance", 'finance estimator navigation'],
  [finance, 'calculateEmi', 'EMI calculation'],
  [finance, 'This is a mathematical estimate only', 'finance estimate disclaimer'],
  [finance, 'Finance enquiry is not connected yet', 'finance integration limitation'],
  [activity, 'onOpenDeal', 'My Exchange deal navigation'],
  [screen, "/customer/exchange/deal", 'deal lifecycle route'],
  [deal, 'getExchangeDealDetail', 'participant deal detail load'],
  [deal, 'confirmExchangeDeal', 'buyer deal confirmation'],
  [deal, 'RC transfer complete', 'deal lifecycle milestone'],
  [screen, "/customer/exchange/[listingId]", 'dedicated vehicle detail route'],
  [detail, 'placeExchangeBid', 'detail transaction action'],
  [detail, 'requestExchangeContact', 'detail managed-contact action'],
  [detail, 'getExchangeMarketplaceFeed', 'detail live listing load'],
  [detail, 'getExchangeListingDetail', 'authoritative vehicle health detail'],
  [detail, 'galleryPhotos', 'private multi-photo gallery'],
  [service, 'signedMedia', 'signed private gallery media'],
  [detail, 'selling_mode', 'detail selling-mode behavior'],
  [sell, 'fixed_price', 'fixed-price seller mode'],
  [sell, 'open_bidding', 'open-offer seller mode'],
  [sell, 'managed_auction', 'managed-auction seller mode'],
  [sell, 'Seller-declared condition', 'seller condition disclosure'],
  [sell, 'Hydraulic condition', 'construction hydraulic condition'],
  [sell, 'Tap for Camera / Gallery', 'guided camera/gallery photo UX'],
  [sell, 'Add another vehicle', 'seller Add Vehicle entry'],
  [screen, "/customer/add-vehicle", 'seller routing to existing fleet onboarding'],
  [addVehicle, 'fromExchange', 'Add Vehicle Exchange return flag'],
  [addVehicle, "/customer/exchange", 'return to Exchange after vehicle onboarding'],
];

for (const [source, contract, label] of requiredArchitectureContracts) {
  if (!source.includes(contract)) {
    throw new Error(`Customer Exchange architecture contract missing (${label}): ${contract}`);
  }
}

const forbiddenAppContracts = [
  'const marketplaceSeed',
  'ex-1001',
  'demo bid',
  'First-draft preview',
  'sample marketplace',
];

for (const contract of forbiddenAppContracts) {
  if (appSource.includes(contract)) {
    throw new Error(`Customer Exchange still contains local-preview contract: ${contract}`);
  }
}

const requiredServiceContracts = [
  'exchange_marketplace_feed',
  'exchange_listing_detail',
  'exchange_deal_detail',
  'exchange_withdraw_offer',
  'exchange_reject_leading_offer',
  'p_selling_mode',
  'exchange_my_sellable_vehicles',
  'exchange_upsert_listing_draft',
  'exchange_submit_listing',
  'exchange_toggle_favorite',
  'exchange_place_bid',
  'exchange_request_contact',
  'exchange_respond_contact_request',
  'exchange_accept_leading_bid',
  'exchange_confirm_deal',
  'exchange_my_activity',
  'exchange_seller_bid_book',
  'exchange_register_listing_media',
  ".from('exchange-media')",
];

for (const contract of requiredServiceContracts) {
  if (!service.includes(contract)) {
    throw new Error(`Exchange service contract missing: ${contract}`);
  }
}

if (!migration.includes('exchange_listing_media')) {
  throw new Error('Exchange migration contract missing: exchange_listing_media');
}

console.log('Customer Exchange live-backend regression contract passed.');
