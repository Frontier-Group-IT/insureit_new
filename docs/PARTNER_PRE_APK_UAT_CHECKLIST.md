# INSUREIT Partner — Pre-APK UAT Checklist

> Runtime: `0.1.0`  
> Scope: current OTA-compatible Partner app only  
> Native build: not authorized by this checklist

## Critical installed-app journeys

Run on the current Partner preview app after the latest OTA has loaded.

### Session and navigation
- cold launch twice after an OTA;
- sign in with an authorized Partner account;
- background the app and return;
- move through Home, Business, Policies, Claims and More;
- open a secondary screen and verify Back returns to the prior context;
- sign out and verify Login replaces the protected stack.

### Customers and policies
- search Customers;
- open a Customer;
- open one of that Customer's Policies;
- return to Customer and Customers without unexpected reset;
- confirm out-of-scope records are not available;
- verify Motor and Non-Motor policy labels/data remain semantically correct.

### Claims
- open Claims;
- filter/search if applicable;
- open a Claim detail;
- verify current status/stage and history remain readable;
- verify Back returns to the previous Claims context.

### Renewals
- open Renewals;
- confirm due/overdue information is actionable and scoped;
- open the related Policy where available.

### Policy Intake
- start a new Policy Intake;
- enter the supported source/customer information;
- select a policy document;
- verify draft preservation and unsaved-file warning;
- submit once;
- verify duplicate submission is not triggered;
- open tracked status;
- verify retry/replacement behavior when attention is required.

### Business and Support
- verify Business values load and show freshness where available;
- open Support;
- verify relationship contact or Operations Desk fallback;
- verify disabled Call/Email states when contact data is unavailable;
- verify Support retry behavior after a load failure.

### Settings, privacy and OTA
- open Settings & app info;
- verify INSUREIT Partner version/runtime information;
- open Privacy Policy;
- use Check for updates;
- verify current-version feedback or successful update/restart behavior.

## Accessibility / resilience spot checks

- all primary actions have usable touch targets;
- selected filters are distinguishable beyond color alone;
- loading/error/offline/unauthorized states do not trap the user;
- retry actions work;
- destructive/sign-out actions require confirmation;
- important validation/error text remains readable at larger text settings.

## Security / scope checks

- no Customer-app session or URL scheme is reused;
- no Partner can navigate to another Partner's record by changing an ID;
- protected cache is cleared on identity/sign-out transitions;
- notification/deep-link destinations, when introduced later, must use the frozen Partner destination contract and re-check authorization on destination load;
- sensitive identifiers are not added to observability metadata or future notification preview text.

## OTA freeze exit gate

The current OTA phase can be considered ready for native batching only when:

1. Partner CI is green, including route, Phase 5, pre-APK freeze and UAT/security contracts;
2. the installed-app journeys above have no known P0/P1 OTA-fixable defect;
3. visual readiness is accepted or remaining visual defects are recorded for OTA correction;
4. remaining work is explicitly native-only or post-native installed-device verification;
5. the exact native dependency batch receives separate approval before any APK/AAB build.
