# Customer Start Claim unexpectedly returns to Home — investigation handoff

Updated: 2026-10-13 (IST)  
Repository: `Frontier-Group-IT/insureit_new`  
App: `apps/mobile-app` (Expo SDK 54, Expo Router ~6.0.24, React Native 0.81.5)  
Severity: User-blocking navigation defect on Android Customer Start Claim page  
Status: **REPRODUCED, action type known; initiating call site NOT YET PROVEN.**

## Symptom
Opening `/customer/start-claim` from `/customer/home` succeeds, but after roughly 1–5 seconds (sometimes after a vehicle selector touch, sometimes elsewhere) the visible page returns to `/customer/home`. A new OTA is NOT necessary to reproduce. Avoid treating the vehicle picker as the proven culprit.

## Direct Android evidence (provided by user)
- **V1 2026-10-12 11:54:** Four Start Claim mounts followed by unmount and route change to Home. OTA runtime `0.3.0`, channel `production`, update `01a1256d-1db3-7028-96d7-4f92480b51cf`. No logged bottom tab / shared dashboard handler event; no root remount between transitions.
- **V2 2026-10-12 12:15:** Four repeated Start Claim -> Home route changes. OTA update `01a12eda-62bf-7f9b-b64e-3d7a07efd629`; initial process restarts happened BEFORE the test. `nav-state` from `useRootNavigationState` only reported `['__root']` index 0, which does not identify nested stack actions. No observed `android-back-event` or `screen-touch-capture` in those four transitions; absence of touch logging is NOT proof a touch never occurred.
- **V3 2026-10-12 13:04–13:05:** OTA update `01a12ee7-b259-7908-83e1-efb02d1721c0`; **four of five** transitions had `[claim-navigation] navigator-dispatch {type:'REPLACE',activeRoute:'customer/start-claim'}` immediately before `start-claim-unmounted` and container transition `customer/start-claim -> customer/home`. Fifth case showed route change but no captured action. Thus programmatic navigator `REPLACE` is implicated, not definitively all transitions.
- **V4 2026-10-13 13:22:** **Four of four** transitions had `navigator-dispatch type:'REPLACE'` immediately followed by Start Claim unmount and `container-route customer/start-claim -> customer/home`. Times 13:22:22.209, 13:22:30.696, 13:22:38.800, 13:22:45.032. **No `[claim-navigation] replace-caller` log from three source-marked handlers** (Customer Home brand, startup routing, shared Screen dashboard handler), so none of those specific handlers is supported by this trace. On second reproduction, `touch-region vehicle-section` (13:22:28.572), `vehicle-selector-icon-press` (13:22:28.627), another section touch (13:22:29.841), and REPLACE at 13:22:30.696. Do not assume the picker initiated REPLACE.

**Important limitations:** V4 log excerpt had no `root-mounted` identity line; OTA activation of the last diagnostic package should be verified independently before interpreting missing markers categorically. No destination/action payload or initiating JS call stack was captured in V4. An event-listener `Error().stack` would identify the listener, not the original dispatch caller.

## Prior fixes and diagnostic PRs
- Earlier history: PRs #1175 (oversized shared header logo pressable), #3029 (remove mid-session `Updates.reloadAsync()`), and earlier #1016/#1128/#1136/#1141/#1151/#1162/#3027. These did not resolve observed V1–V4 repros.
- **#3049** merged `01246e6...`: root and Start Claim mount/route logging, shared header and bottom-tab event logging, touch-region probes.
- **#3082** merged `6f9c8495...`: Android hardware Back observer, root nav-state snapshot, shared Screen `onTouchStart` coordinates (after correcting type issues; Mobile CI #1241, Web CI #5969 green).
- **#3083** merged `286b6e2f...`: `useNavigationContainerRef().addListener('state', ...)` and best-effort private `__unsafe_action__` observer; `REPLACE` proven in V3 (Mobile #1243, Web #5972 green).
- **#3088** merged `158c148f...`: source markers for Customer Home ordinary brand, `routeRestoredUser` role-router, and shared Screen dashboard `router.replace` (Mobile #1244, Web #5976 green). No corresponding markers appeared in user V4 trace.
- **Current branch** `diagnostic/customer-claim-replace-source-and-handoff-20261013`: adds missing **group/portfolio Customer Home brand `router.replace('/customer/home')`** marker in `components/group/group-home-screen.tsx`, and records a strictly allowlisted destination value for `REPLACE` actions in `app/_layout.tsx` (`customer/home` vs `other-or-unknown`). This does NOT establish the call site and must not be described as the permanent fix.

## Significant code findings
- `app/customer/home.tsx` branches to `<GroupHomeScreen>` for portfolio contexts. Both normal Home and Group Home have a logo pressable calling `router.replace('/customer/home')`; PR #3088 instrumented **only the normal Home** brand, leaving Group Home uninstrumented until current branch. This is a candidate, NOT proof that Group Home brand receives touches behind Start Claim.
- `components/ui.tsx` disables the shared header dashboard press for Start Claim; older handler probe didn't fire in V4.
- `lib/startup-routing.ts` can `router.replace(routeForRole(profile.role))`, but startup diagnostics resolved prior to user opening Start Claim, with no evidence it runs mid-session.
- `app/customer/start-claim.tsx` only known navigation in direct screen handlers routes to claim detail/claim reporting, add policy, or login when session absent; does not intentionally REPLACE Home from the selector.

## Next investigation (must follow evidence)
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
