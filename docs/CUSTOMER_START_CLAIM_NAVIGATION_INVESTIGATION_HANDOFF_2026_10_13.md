# Customer Start Claim unexpectedly returns to Home — investigation handoff

Updated: 2026-10-13 (IST)  
Repository: `Frontier-Group-IT/insureit_new`  
App: `apps/mobile-app` (Expo SDK 54, Expo Router ~6.0.24, React Native 0.81.5)  
Severity: User-blocking navigation defect on Android Customer Start Claim page  
Status: **REPRODUCED; 15/15 V5 failures dispatched REPLACE to customer/home; actual live Customer header redirect discovered but caller remains unproven pending V6 device logs.**

## Symptom
Opening `/customer/start-claim` from `/customer/home` succeeds, but after roughly 1–5 seconds (sometimes after a vehicle selector touch, sometimes elsewhere) the visible page returns to `/customer/home`. A new OTA is NOT necessary to reproduce. Avoid treating the vehicle picker as the proven culprit.

## Direct Android evidence (provided by user)
- **V1 2026-10-12 11:54:** Four Start Claim mounts followed by unmount and route change to Home. OTA runtime `0.3.0`, channel `production`, update `01a1256d-1db3-7028-96d7-4f92480b51cf`. No logged bottom tab / shared dashboard handler event; no root remount between transitions.
- **V2 2026-10-12 12:15:** Four repeated Start Claim -> Home route changes. OTA update `01a12eda-62bf-7f9b-b64e-3d7a07efd629`; initial process restarts happened BEFORE the test. `nav-state` from `useRootNavigationState` only reported `['__root']` index 0, which does not identify nested stack actions. No observed `android-back-event` or `screen-touch-capture` in those four transitions; absence of touch logging is NOT proof a touch never occurred.
- **V3 2026-10-12 13:04–13:05:** OTA update `01a12ee7-b259-7908-83e1-efb02d1721c0`; **four of five** transitions had `[claim-navigation] navigator-dispatch {type:'REPLACE',activeRoute:'customer/start-claim'}` immediately before `start-claim-unmounted` and container transition `customer/start-claim -> customer/home`. Fifth case showed route change but no captured action. Thus programmatic navigator `REPLACE` is implicated, not definitively all transitions.
- **V4 2026-10-13 13:22:** **Four of four** transitions had `navigator-dispatch type:'REPLACE'` immediately followed by Start Claim unmount and `container-route customer/start-claim -> customer/home`. Times 13:22:22.209, 13:22:30.696, 13:22:38.800, 13:22:45.032. **No `[claim-navigation] replace-caller` log from three source-marked handlers** (Customer Home brand, startup routing, shared Screen dashboard handler), so none of those specific handlers is supported by this trace. On second reproduction, `touch-region vehicle-section` (13:22:28.572), `vehicle-selector-icon-press` (13:22:28.627), another section touch (13:22:29.841), and REPLACE at 13:22:30.696. Do not assume the picker initiated REPLACE.

- **V5 2026-10-13 13:36–13:38:** User uploaded ~259-line ADB trace. Production runtime `0.3.0`, channel `production`, OTA update `01a1344a-82cc-71d6-a939-bd26de7764ab`. **15/15** Start Claim → Home transitions were preceded by `navigator-dispatch { type:'REPLACE', activeRoute:'customer/start-claim', destination:'customer/home' }`. Only `replace-caller source:'startup-routing'` appeared twice, both **before** entering Start Claim, not during any failure. No `replace-caller` marker for normal Home logo, group Home logo, or `components/ui.tsx` dashboard handler in the redirect sequences. Vehicle selector touched during several repros but causal connection remains unproven. No JS root remount during 15 transitions.

**Important limitations:** V4 log excerpt had no `root-mounted` identity line; OTA activation of the last diagnostic package should be verified independently before interpreting missing markers categorically. No destination/action payload or initiating JS call stack was captured in V4. An event-listener `Error().stack` would identify the listener, not the original dispatch caller.

## Prior fixes and diagnostic PRs
- Earlier history: PRs #1175 (oversized shared header logo pressable), #3029 (remove mid-session `Updates.reloadAsync()`), and earlier #1016/#1128/#1136/#1141/#1151/#1162/#3027. These did not resolve observed V1–V4 repros.
- **#3049** merged `01246e6...`: root and Start Claim mount/route logging, shared header and bottom-tab event logging, touch-region probes.
- **#3082** merged `6f9c8495...`: Android hardware Back observer, root nav-state snapshot, shared Screen `onTouchStart` coordinates (after correcting type issues; Mobile CI #1241, Web CI #5969 green).
- **#3083** merged `286b6e2f...`: `useNavigationContainerRef().addListener('state', ...)` and best-effort private `__unsafe_action__` observer; `REPLACE` proven in V3 (Mobile #1243, Web #5972 green).
- **#3088** merged `158c148f...`: source markers for Customer Home ordinary brand, `routeRestoredUser` role-router, and shared Screen dashboard `router.replace` (Mobile #1244, Web #5976 green). No corresponding markers appeared in user V4 trace.
- **#3109** merged as `62aff594...`, mobile CI #1319 and web CI #6078 green, production Customer OTA run #192 `38366465590` verified success. This contains the group Home logo caller marker, root REPLACE destination and this handoff.
- **Previous branch** `diagnostic/customer-claim-replace-source-and-handoff-20261013`: adds missing **group/portfolio Customer Home brand `router.replace('/customer/home')`** marker in `components/group/group-home-screen.tsx`, and records a strictly allowlisted destination value for `REPLACE` actions in `app/_layout.tsx` (`customer/home` vs `other-or-unknown`). This does NOT establish the call site and must not be described as the permanent fix.

## NEW 2026-10-13: Effective Customer UI alias — strongest uninstrumented code candidate
- **IMPORTANT:** `apps/mobile-app/tsconfig.json` maps `@/components/ui` to `./components/customer-aware-ui`, and `apps/mobile-app/babel.config.js` maps `^@/components/ui# Customer Start Claim unexpectedly returns to Home — investigation handoff

Updated: 2026-10-13 (IST)  
Repository: `Frontier-Group-IT/insureit_new`  
App: `apps/mobile-app` (Expo SDK 54, Expo Router ~6.0.24, React Native 0.81.5)  
Severity: User-blocking navigation defect on Android Customer Start Claim page  
Status: **REPRODUCED; 15/15 V5 failures dispatched REPLACE to customer/home; actual live Customer header redirect discovered but caller remains unproven pending V6 device logs.**

## Symptom
Opening `/customer/start-claim` from `/customer/home` succeeds, but after roughly 1–5 seconds (sometimes after a vehicle selector touch, sometimes elsewhere) the visible page returns to `/customer/home`. A new OTA is NOT necessary to reproduce. Avoid treating the vehicle picker as the proven culprit.

## Direct Android evidence (provided by user)
- **V1 2026-10-12 11:54:** Four Start Claim mounts followed by unmount and route change to Home. OTA runtime `0.3.0`, channel `production`, update `01a1256d-1db3-7028-96d7-4f92480b51cf`. No logged bottom tab / shared dashboard handler event; no root remount between transitions.
- **V2 2026-10-12 12:15:** Four repeated Start Claim -> Home route changes. OTA update `01a12eda-62bf-7f9b-b64e-3d7a07efd629`; initial process restarts happened BEFORE the test. `nav-state` from `useRootNavigationState` only reported `['__root']` index 0, which does not identify nested stack actions. No observed `android-back-event` or `screen-touch-capture` in those four transitions; absence of touch logging is NOT proof a touch never occurred.
- **V3 2026-10-12 13:04–13:05:** OTA update `01a12ee7-b259-7908-83e1-efb02d1721c0`; **four of five** transitions had `[claim-navigation] navigator-dispatch {type:'REPLACE',activeRoute:'customer/start-claim'}` immediately before `start-claim-unmounted` and container transition `customer/start-claim -> customer/home`. Fifth case showed route change but no captured action. Thus programmatic navigator `REPLACE` is implicated, not definitively all transitions.
- **V4 2026-10-13 13:22:** **Four of four** transitions had `navigator-dispatch type:'REPLACE'` immediately followed by Start Claim unmount and `container-route customer/start-claim -> customer/home`. Times 13:22:22.209, 13:22:30.696, 13:22:38.800, 13:22:45.032. **No `[claim-navigation] replace-caller` log from three source-marked handlers** (Customer Home brand, startup routing, shared Screen dashboard handler), so none of those specific handlers is supported by this trace. On second reproduction, `touch-region vehicle-section` (13:22:28.572), `vehicle-selector-icon-press` (13:22:28.627), another section touch (13:22:29.841), and REPLACE at 13:22:30.696. Do not assume the picker initiated REPLACE.

- **V5 2026-10-13 13:36–13:38:** User uploaded ~259-line ADB trace. Production runtime `0.3.0`, channel `production`, OTA update `01a1344a-82cc-71d6-a939-bd26de7764ab`. **15/15** Start Claim → Home transitions were preceded by `navigator-dispatch { type:'REPLACE', activeRoute:'customer/start-claim', destination:'customer/home' }`. Only `replace-caller source:'startup-routing'` appeared twice, both **before** entering Start Claim, not during any failure. No `replace-caller` marker for normal Home logo, group Home logo, or `components/ui.tsx` dashboard handler in the redirect sequences. Vehicle selector touched during several repros but causal connection remains unproven. No JS root remount during 15 transitions.

**Important limitations:** V4 log excerpt had no `root-mounted` identity line; OTA activation of the last diagnostic package should be verified independently before interpreting missing markers categorically. No destination/action payload or initiating JS call stack was captured in V4. An event-listener `Error().stack` would identify the listener, not the original dispatch caller.

## Prior fixes and diagnostic PRs
- Earlier history: PRs #1175 (oversized shared header logo pressable), #3029 (remove mid-session `Updates.reloadAsync()`), and earlier #1016/#1128/#1136/#1141/#1151/#1162/#3027. These did not resolve observed V1–V4 repros.
- **#3049** merged `01246e6...`: root and Start Claim mount/route logging, shared header and bottom-tab event logging, touch-region probes.
- **#3082** merged `6f9c8495...`: Android hardware Back observer, root nav-state snapshot, shared Screen `onTouchStart` coordinates (after correcting type issues; Mobile CI #1241, Web CI #5969 green).
- **#3083** merged `286b6e2f...`: `useNavigationContainerRef().addListener('state', ...)` and best-effort private `__unsafe_action__` observer; `REPLACE` proven in V3 (Mobile #1243, Web #5972 green).
- **#3088** merged `158c148f...`: source markers for Customer Home ordinary brand, `routeRestoredUser` role-router, and shared Screen dashboard `router.replace` (Mobile #1244, Web #5976 green). No corresponding markers appeared in user V4 trace.
- **#3109** merged as `62aff594...`, mobile CI #1319 and web CI #6078 green, production Customer OTA run #192 `38366465590` verified success. This contains the group Home logo caller marker, root REPLACE destination and this handoff.
- **Previous branch** `diagnostic/customer-claim-replace-source-and-handoff-20261013`: adds missing **group/portfolio Customer Home brand `router.replace('/customer/home')`** marker in `components/group/group-home-screen.tsx`, and records a strictly allowlisted destination value for `REPLACE` actions in `app/_layout.tsx` (`customer/home` vs `other-or-unknown`). This does NOT establish the call site and must not be described as the permanent fix.

 to `./components/customer-aware-ui`. Most Customer screens, including `app/customer/start-claim.tsx`, import this alias. Thus their effective `Screen` is `CustomerFixedScreen`, NOT the previously instrumented base `components/ui.tsx` `Screen`. The base component's Start Claim dashboard guard and screen-touch logger were not the active Customer screen logic. This plausibly explains why those earlier logs did not fire.
- `apps/mobile-app/components/customer-aware-ui.tsx` currently renders **an always-enabled fixed brand `Pressable`** with `onPress={() => router.replace('/customer/home')}`. The Start Claim screen renders it with `showBackNavigation={false}` but still gets this clickable brand. This is an exact code path capable of producing the `REPLACE customer/home` payload, but press invocation during failures is NOT proven.
- **Current branch** `diagnostic/customer-fixed-header-replace-origin-v6-20261013` adds Start Claim-only markers on actual `CustomerFixedScreen`: `live-customer-screen-touch` for real header, logo press-in, fixed content, and scroll body, and `replace-caller source:'customer-fixed-screen-brand'` immediately before its `router.replace('/customer/home')`. Also logs real Customer back-fallback path. Instrumentation is read-only, logs numeric touch coordinates only, does not block header or alter customer navigation, and is not a permanent fix.

## Significant code findings
- `app/customer/home.tsx` branches to `<GroupHomeScreen>` for portfolio contexts. Both normal Home and Group Home have a logo pressable calling `router.replace('/customer/home')`; PR #3088 instrumented **only the normal Home** brand, leaving Group Home uninstrumented until current branch. This is a candidate, NOT proof that Group Home brand receives touches behind Start Claim.
- `components/ui.tsx` disables the shared header dashboard press for Start Claim; older handler probe didn't fire in V4.
- `lib/startup-routing.ts` can `router.replace(routeForRole(profile.role))`, but startup diagnostics resolved prior to user opening Start Claim, with no evidence it runs mid-session.
- `app/customer/start-claim.tsx` only known navigation in direct screen handlers routes to claim detail/claim reporting, add policy, or login when session absent; does not intentionally REPLACE Home from the selector.

## Next V6 investigation (must follow evidence)
1. Verify CI and PR for the real Customer wrapper instrumentation; merge/publish only with authorization and green checks, no APK/AAB.
2. Cold launch twice with internet to activate the OTA, record update identity. `adb logcat -c`, `adb logcat -v time -s ReactNativeJS:V > "$env:USERPROFILE\\Desktop\\claim-navigation-v6.txt"` on Windows, reproduce and Ctrl+C.
3. If each `navigator-dispatch REPLACE customer/home` is preceded by **`replace-caller source:'customer-fixed-screen-brand'`**, the exact executing handler is identified. Compare `fixed-header-logo-press-in` coordinates with the user's intended tap location; find why user touches hit the header. If REPLACE persists **without** this marker, inspect non-brand navigation and redirect entry points. No causal assertion until device evidence.
4. After confirmation implement a minimal remedy on a NEW branch (e.g. make brand non-interactive only on Start Claim, preserving other Customer pages), run smoke/regressions and OTA. Remove diagnostic code once verified.

## Prior investigation instructions (historical)
1. Run Mobile/Web GitHub checks on current branch. Keep it as a separate PR until checks green; do not publish unreviewed changes.
2. If user approves or expects progression, merge clean diagnostic PR after CI; use existing `publish-customer-release-production-ota.yml` which auto-publishes on mobile file push to main to runtime `0.3.0` production. Independently verify the OTA run (CI success alone is NOT publication). **Never build APK/AAB** unless user explicitly asks.
3. Cold launch twice online; capture `adb logcat -c` then `adb logcat -v time -s ReactNativeJS:V > "$env:USERPROFILE\Desktop\claim-navigation-v5.txt"`, reproduce, Ctrl+C, upload log. Compare `replace-caller source:'group-home-brand'` and `navigator-dispatch REPLACE destination:'customer/home'` timestamps.
4. If still no caller marker, do NOT conclude group-home or picker. Survey all mobile-app `router.replace` call sites and native navigation ownership, including stacked Home component and hidden overlay/touch handling. Strongest next diagnostic is a **call-site-specific marker or constrained navigation wrapper** (not a broad interception monkey patch), with exact initiator; do not log personal route params or raw customer/policy identifiers.
5. Once proven, implement narrowly scoped fix on separate branch, run regressions, merge and publish runtime-compatible OTA, reproduce on device, and remove temporary diagnostics.

## Safety and scope
- No database schema/migration changes and no customer-data modification for this investigation.
- No native module changes, APK or AAB builds.
- Source logs contain static labels, action type and safe route names only; never log action payloads, navigation state keys, claim ID, user ID, vehicle number, policy number or authentication material.
- Update this handoff with each device repro, actual CI result, PR number, release ID and definitive cause when known. Do not report speculative hypotheses as facts.


## V6 confirmed navigation caller and surgical fix — 2026-10-13

**User device V6 evidence:** captured 13:58:34–13:59:18 IST (Android Logcat, 160 lines). There are **eight** unwanted `/customer/start-claim -> /customer/home` redirects; **all eight** were preceded by `[claim-navigation] replace-caller { source: 'customer-fixed-screen-brand', destination: '/customer/home' }`, followed by `navigator-dispatch { type: 'REPLACE', activeRoute: 'customer/start-claim', destination: 'customer/home' }` and `start-claim-unmounted`. This conclusively identifies the **executing navigation handler**: `openDashboard()` on the fixed brand `Pressable` inside `apps/mobile-app/components/customer-aware-ui.tsx`, which is the real `@/components/ui` target for Customer screens. Earlier `components/ui.tsx` instrumentation had targeted the wrong wrapper.

The `fixed-header-logo-press-in` touch coordinates include (179,188), (375,326), (262,375), (266,389), (375,317), (300,223) and others — screen positions substantially lower than the expected 58-point header. This indicates abnormal responder targeting/hit testing of the logo control, **but the exact native layout cause of the oversized/inappropriate responder target has NOT been established**. It is not evidence that the vehicle selector causes navigation.

**Targeted fix branch:** `fix/customer-start-claim-static-header-brand-20261013`. In the active `CustomerFixedScreen`, render `BrandLogo width={132} inverse` inside a static `View pointerEvents="none"` only when `pathname === '/customer/start-claim'`. For all other Customer paths retain the original `Pressable` and `openDashboard` behavior. Preserve existing header appearance and navigation structure. The static logo should no longer dispatch a Home `REPLACE` in response to mis-targeted taps. Update the existing `customer-start-claim-live-header-diagnostic-regression.mjs` contract to assert the inactive Start Claim branch and retained interactive branch; run through `Verify mobile app`.

**Evidence states:** Function responsible is **CONFIRMED** on V6. Lower-screen hit-target origin is **NOT EXPLAINED**. Surgical code change is **IMPLEMENTED ON BRANCH ONLY** until PR CI/merge/OTA/device confirmation. Do not call issue fully resolved until installed-device test confirms Start Claim remains open while tapping vehicle selector and other controls repeatedly, and other Customer pages retain dashboard-logo navigation.

**Next actions:** Run full mobile/web checks; create PR; merge/publish only when approved; confirm production OTA update ID after cold restart; capture V7 Android log and verify no `REPLACE customer/home` on Start Claim after 10+ selector interactions. Preserve no-APK/AAB rule. If unexpected header touches still intercept controls after redirect stops, separately investigate header/native hitbox sizing; do not widen the scope of this fix without evidence.


## User-verified bug resolution and full-field selector change — 2026-10-13

**Resolution verification level:** After PR **#3113** merged as `1975615445eb684c4b6815206de4a1f92aa248ce` and Customer production OTA **run #194 (38370662020)** completed with successful Expo publish/channel verification, the user explicitly confirmed: **"ok its working now"**. This is **USER-VERIFIED functional recovery**; no independent V7 device trace or explanation of the abnormal header native touch geometry has been provided. Do not conflate the confirmed initiating JS handler with a proven root reason for the abnormal Android responder hit-box.

**Important lesson for future agents:** The Start Claim screen imports `Screen` from `@/components/ui`, which resolves via BOTH `tsconfig.json` and `babel.config.js` to `components/customer-aware-ui.tsx`. Earlier investigations instrumented `components/ui.tsx` by mistake. The effective `CustomerFixedScreen` contained an always-clickable header logo; V6 logs showed eight of eight unwanted `REPLACE customer/home` actions originated from `customer-fixed-screen-brand`. PR #3113 made that logo a noninteractive static `View pointerEvents="none"` ONLY on `/customer/start-claim`, preserving normal logo navigation elsewhere. **Do not remove this route-specific guard or restore the interactive logo.**

**Current follow-up user request:** Instead of a small icon-only tap target on the right of the Start Claim vehicle row, opening the vehicle dropdown should work when tapping **anywhere in the vehicle selection section**. This includes label, bordered vehicle card (manufacturer logo, vehicle number, make/model, and list icon) and the helper line when vehicles exist. Preserve no-vehicles empty state.

**Implementation on branch `ux/customer-start-claim-full-field-vehicle-selector-20261013` (NOT YET MERGED OR PUBLISHED):**
- `apps/mobile-app/app/customer/start-claim.tsx`: renders **a single** accessible `Pressable` around the selector label, row and helper. The original right-side icon is only a decorative `View`; no nested `Pressable` or `hitSlop`. New static event `vehicle-selector-field-press` (no PII) appears before opening the dropdown. Keeps the same measured anchor (`ref={anchorRef}`, `collapsable={false}`, `measureInWindow`) with `pointerEvents="none"` inside the press target; retains modal overlay, search, selection and dismissal. The floating modal is a sibling of the press target, not inside its responder tree. No Customer header code modified.
- `apps/mobile-app/scripts/customer-start-claim-full-field-selector-regression.mjs`: checks the single responder, label/card/helper coverage, passive list icon, measured modal, search/select/dismiss, no oversized hitSlop, and preservation of the route-specific protected static Customer header; wired into `Verify mobile app`.
- `AGENTS.md` and this handoff both describe the V6 root-caller proof, UI import alias and permanent header safety rule.
- Status: **IMPLEMENTED IN SEPARATE BRANCH; PR/CI/MERGE/PRODUCTION OTA/DEVICE USER ACCEPTANCE PENDING.** No database, migration, APK/AAB or native change.

**Post-merge device acceptance:** Cold-launch the newest production runtime 0.3.0 OTA twice if necessary, enter Start Claim, tap manufacturer logo, vehicle number, make/model, right list icon, field label and helper line. Each tap should open the *same* anchored searchable modal. Choose a vehicle, confirm the selected vehicle and policy update correctly; close and re-open modal. Verify Start Claim never redirects to Home. Also confirm the Customer header logo still navigates from other screens while remaining noninteractive on Start Claim. If a `REPLACE` returns, capture targeted Logcat and compare to historical `customer-fixed-screen-brand`; do not reflexively change unrelated navigation or authentication code.

