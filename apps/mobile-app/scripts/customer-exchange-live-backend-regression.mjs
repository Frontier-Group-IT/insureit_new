import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const screenPath = path.join(root, 'apps/mobile-app/app/customer/exchange.tsx');
const servicePath = path.join(root, 'apps/mobile-app/lib/exchange.ts');

const screen = fs.readFileSync(screenPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

const requiredScreenContracts = [
  "getSelectedCustomerContext",
  "getExchangeMarketplaceFeed",
  "getExchangeSellableVehicles",
  "getExchangeActivity",
  "toggleExchangeFavorite",
  "placeExchangeBid",
  "requestExchangeContact",
  "saveExchangeListingDraft",
  "submitExchangeListing",
  "getExchangeSellerBidBook",
  "acceptExchangeLeadingBid",
  "respondExchangeContactRequest",
  "confirmExchangeDeal",
  "uploadExchangePhoto",
  "requestMediaLibraryPermissionsAsync",
  "launchImageLibraryAsync",
  "Submit for review",
];

for (const contract of requiredScreenContracts) {
  if (!screen.includes(contract)) {
    throw new Error(`Customer Exchange live-backend contract missing: ${contract}`);
  }
}

const forbiddenScreenContracts = [
  "const marketplaceSeed",
  "ex-1001",
  "demo bid",
  "First-draft preview",
  "sample marketplace",
];

for (const contract of forbiddenScreenContracts) {
  if (screen.includes(contract)) {
    throw new Error(`Customer Exchange still contains local-preview contract: ${contract}`);
  }
}

const requiredServiceContracts = [
  "exchange_marketplace_feed",
  "exchange_my_sellable_vehicles",
  "exchange_upsert_listing_draft",
  "exchange_submit_listing",
  "exchange_toggle_favorite",
  "exchange_place_bid",
  "exchange_request_contact",
  "exchange_respond_contact_request",
  "exchange_accept_leading_bid",
  "exchange_confirm_deal",
  "exchange_my_activity",
  "exchange_seller_bid_book",
  "exchange_register_listing_media",
  ".from('exchange-media')",
];

for (const contract of requiredServiceContracts) {
  if (!service.includes(contract)) {
    throw new Error(`Exchange service contract missing: ${contract}`);
  }
}

console.log('Customer Exchange live-backend regression contract passed.');
