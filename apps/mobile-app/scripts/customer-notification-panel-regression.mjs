import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const realtime = await readFile(new URL('../components/realtime-notifications.tsx', import.meta.url), 'utf8');
const customerRoute = await readFile(new URL('../app/customer/notifications.tsx', import.meta.url), 'utf8');
const customerHome = await readFile(new URL('../app/customer/home.tsx', import.meta.url), 'utf8');
const groupHome = await readFile(new URL('../components/group/group-home-screen.tsx', import.meta.url), 'utf8');
const groupShell = await readFile(new URL('../components/group/group-page-shell.tsx', import.meta.url), 'utf8');

assert.match(realtime, /const customerMode = pathname\.startsWith\('\/customer'\)/, 'Customer bell behavior must stay scoped to customer routes.');
assert.match(realtime, /visible=\{panelOpen\}/, 'Customer notifications must expand in-place from the bell.');
assert.match(realtime, /notificationPanelRowUnread/, 'Unread notifications must have a highlighted row style.');
assert.match(realtime, /notification\.status === 'unread'/, 'Unread state must be driven by persisted notification status.');
assert.match(realtime, /backgroundColor: '#F2F7FF'/, 'Unread rows must use the approved subtle highlight.');
assert.match(realtime, /backgroundColor: '#FFFFFF'/, 'Read rows must remain visually normal.');
assert.doesNotMatch(realtime, /router\.push\('\/customer\/notifications'\)/, 'Customer bell must not navigate to a dedicated notifications page.');

assert.match(customerRoute, /<Redirect href="\/customer\/home" \/>/, 'Legacy customer notification route must safely redirect home.');
assert.doesNotMatch(customerHome, /router\.push\('\/customer\/notifications'\)/, 'Customer home header must not navigate to the notification page.');
assert.doesNotMatch(groupHome, /router\.push\('\/customer\/notifications'\)/, 'Group customer home header must not navigate to the notification page.');
assert.doesNotMatch(groupShell, /router\.push\('\/customer\/notifications'\)/, 'Group customer shell must not navigate to the notification page.');

assert.doesNotMatch(realtime, /Unread Summary/, 'Expanded bell panel must not reintroduce summary cards.');
assert.doesNotMatch(realtime, /View all/, 'Expanded bell panel must not reintroduce category summary controls.');

console.log('Customer notification bell panel regression passed.');
