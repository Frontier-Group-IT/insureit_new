# Mobile Production OTA Follow-up

> Active release follow-up for INSUREIT Customer App 0.3.0. Do not store secrets in this file.

## Pending task

Set up a safeguarded Expo production OTA workflow for customer runtime `0.3.0` after the Play Store build has been installed and tested successfully and PR #1258 has been finalized/merged.

## Automatic trigger for future agent

When the following conditions are both true, begin this task without waiting for the user to remember it:

1. The INSUREIT Customer `0.3.0` Play build has passed device testing through Google Play (internal or closed testing).
2. PR #1258 / the corresponding native 0.3.0 release work has been finalized so the production OTA workflow can target the released source/runtime safely.

If either condition is not yet verified, keep this item pending and continue the Play testing/release work first.

## Required implementation boundaries

- Create a protected production OTA path for Expo runtime `0.3.0` and the `production` channel/branch used by the Play build.
- Keep the existing `0.2.0` preview OTA path separate; do not repoint or silently reuse it for production.
- Publish OTA only for JS/TS/UI/business-logic or bundled-asset changes that are compatible with runtime `0.3.0`.
- Require a new AAB/native build for native dependency/plugin changes, Android permissions, native app configuration, package identity, SDK/runtime changes, or any other native-runtime change.
- Require exact source commit, clean working tree, correct runtime/channel, required public Expo environment values, and successful mobile CI before production OTA publication.
- Do not publish a production OTA merely because a commit exists; verify the intended released source state first.
- After every production OTA, verify the Play-installed app on a real device with cold launches and the affected user journey before claiming success.

## Completion condition

Mark this task complete only after the safeguarded `0.3.0` production OTA workflow is implemented, CI-verified, documented, and one controlled production-channel OTA has been successfully verified on the Play-installed app (or the user explicitly chooses to defer the first live OTA test).
