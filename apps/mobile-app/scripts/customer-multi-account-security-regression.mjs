import fs from 'node:fs';

const vault = fs.readFileSync(new URL('../lib/customer-account-vault.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../app/login.tsx', import.meta.url), 'utf8');
const startup = fs.readFileSync(new URL('../lib/startup-routing.ts', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../components/ui.tsx', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../app/customer/home.tsx', import.meta.url), 'utf8');
const groupHome = fs.readFileSync(new URL('../components/group/group-home-screen.tsx', import.meta.url), 'utf8');
const switcher = fs.readFileSync(new URL('../components/customer-account-switcher.tsx', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(vault.includes("from 'expo-secure-store'"), 'Remembered customer session secrets must use expo-secure-store.');
assert(vault.includes('WHEN_UNLOCKED_THIS_DEVICE_ONLY'), 'SecureStore must use this-device-only accessibility.');
assert(!vault.includes("AsyncStorage.setItem(sessionKey"), 'Session secrets must never be stored in AsyncStorage.');
assert(vault.includes('data.session.user.id !== userId'), 'Every restored session must validate the selected user id.');
assert(vault.includes('maxRememberedAccounts = 5'), 'Remembered account count must remain bounded.');

assert(login.includes('candidateSessionInstalled'), 'Add-account flow must track when OTP changed the active Supabase session.');
assert(login.includes('switchToRememberedCustomerAccount(previousUserId)'), 'Every failed add-account attempt must restore the prior saved session.');
assert(login.includes("supabase.auth.signOut({ scope: 'local' })"), 'Add-account failure must sign out the candidate if prior restoration is impossible.');
assert(login.includes('removeRememberedCustomerAccount(candidateUserId)'), 'Failed candidate accounts must not remain in the saved vault.');
assert(login.includes('Only an active Customer App account can be added here.'), 'Add-account flow must reject non-customer or inactive identities.');

assert(auth.includes('isRememberedCustomerUser(currentUserId)'), 'Sign-out classification must be available from local remembered state.');
assert(auth.includes('Normal sign-out never destroys unrelated remembered Customer App accounts.'), 'Normal sign-out must preserve unrelated remembered customer accounts.');
assert(auth.includes('clearSelectedCustomerContextForUser(currentUserId)'), 'Customer sign-out must clear only the active user context.');

assert(!startup.includes('clearSelectedCustomerContext()'), 'Cold start must preserve per-user selected customer contexts.');
assert(startup.includes('removeRememberedCustomerAccount(user.id)'), 'Inactive customer startup must remove only that remembered account.');
assert(!startup.includes('resetLocalAuthState(router)'), 'Inactive customer startup must not wipe the full remembered-account vault.');

assert(ui.includes('CustomerAccountSwitcherButton'), 'Shared customer headers must use the secure account switcher.');
assert(home.includes('CustomerAccountSwitcherButton'), 'Standard Customer Home header must use the secure account switcher.');
assert(groupHome.includes('CustomerAccountSwitcherButton'), 'Portfolio Customer Home header must use the secure account switcher.');
assert(switcher.includes('switchToRememberedCustomerAccount'), 'Switcher must activate Supabase sessions, not just change customer ids.');
assert(switcher.includes('const previousSession = await getCurrentSession()'), 'Switcher must snapshot the prior authenticated session before changing accounts.');
assert(switcher.includes('targetSessionInstalled = true'), 'Switcher must track when the target Supabase session is active.');
assert(switcher.includes('restoreCustomerSessionSnapshot(previousSession)'), 'Routing failures after a session switch must restore the previous authenticated customer.');
assert(vault.includes('data.session.user.id !== session.user.id'), 'Previous-session restoration must verify exact user identity.');
assert(switcher.includes("pathname: '/login', params: { addAccount: '1' }"), 'Switcher Add account / reauth must use explicit OTP add-account mode.');

console.log('Customer multi-account security regression checks passed.');
