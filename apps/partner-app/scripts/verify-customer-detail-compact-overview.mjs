import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/customer/[id].tsx', import.meta.url), 'utf8');
const contacts = readFileSync(new URL('../components/ui/partner-contact-actions.tsx', import.meta.url), 'utf8');

// Keep customer identity, active badge, routes and contact behavior; present only icons.
assert.match(screen, /<PartnerContactActions phone=\{data\.customer\.phone\} email=\{data\.customer\.email\} customerDetailIconOnly \/>/);
assert.doesNotMatch(screen, /inlineLabeled customerDetailLayout/, 'Customer detail must not show action text labels');
assert.match(contacts, /customerDetailIconOnly && styles\.customerIconRow/);
assert.match(contacts, /customerDetailIconOnly && styles\.customerIconButton/);
for (const label of ['Call', 'WhatsApp', 'Email']) assert.ok(contacts.includes(`label="${label}"`), 'Accessible contact action: ' + label);
for (const url of ['tel:+91', 'https://wa.me/91', 'mailto:']) assert.ok(contacts.includes(url), 'Contact route preserved: ' + url);
assert.match(contacts, /disabled=\{!normalizedPhone\}/);
assert.match(contacts, /disabled=\{!email\}/);
assert.match(contacts, /\(!compact \|\| iconOnlyVertical \|\| inlineLabeled\)/, 'Email remains present in non-compact icon-only layout');

// Badges must use already-authorized customer summary; no synthetic counts.
assert.match(screen, /key === 'vehicles' \? data\.summary\.vehicles : data\.summary\.policies/);
assert.match(screen, /key !== 'overview'/);
assert.match(screen, /accessibilityRole="tab"/);
assert.match(screen, /activeTab === key/);

// Confirm all six existing fields are sourced unchanged, only presentation changes.
for (const field of [
  'data.customer.customer_type', 'data.customer.created_at', 'data.customer.intermediary_code',
  'data.customer.status', 'data.customer.customer_code', 'data.customer.fleet_size_band',
]) assert.ok(screen.includes(field), 'Customer information field preserved: ' + field);
assert.match(screen, /<View style=\{redesign\.overviewGrid\}>/);
assert.match(screen, /<OverviewTile icon="business-outline"/);
assert.match(screen, /<OverviewDetailLine icon="id-card-outline"/);
assert.match(screen, /<OverviewDetailLine icon="car-outline"/);
assert.match(screen, /data\.summary\.renewals_30_days > 0/, 'Renewal attention preserved');
assert.match(screen, /data\.claims\.map/, 'Claims section preserved');
assert.match(screen, /data\.vehicles\.map/, 'Vehicles section preserved');
assert.match(screen, /data\.policies\.map/, 'Policies section preserved');
assert.match(screen, /getPartnerCustomerDetail\(id\)/, 'Authorized customer RPC preserved');
console.log('Partner Customer Details UI-only compact overview and contact controls regression passed.');
