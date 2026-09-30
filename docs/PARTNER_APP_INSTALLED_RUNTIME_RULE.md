# Partner App Installed Runtime Delivery Rule

## Mandatory rule — read before every Partner App change

**Current installed Partner APK:** `0.1.0 (5)`

Any Partner App change requested by the user must be delivered to the **latest installed APK through its compatible Expo runtime**, which is currently **runtime `0.1.0`**.

Do **not** treat a successful runtime `0.2.0` OTA as delivery of a Partner App change while the installed APK remains `0.1.0 (5)`.

For every Partner App task, before implementation:

1. Read this rule and the mobile Expo handoff.
2. Confirm the installed Partner APK/runtime target is still `0.1.0 (5)` / runtime `0.1.0`, unless the user has explicitly confirmed a newer APK is installed.
3. Implement/synchronize the requested Partner change into the runtime-`0.1.0` compatibility source/workflow as required.
4. Run the required Partner App checks before merge.
5. Publish through the runtime-`0.1.0` compatible OTA path after merge when publishing is requested.
6. Do not create a new APK/AAB unless the user explicitly asks for one.
7. After implementation/publish, explicitly tell the user which installed APK/runtime received the change. Use wording such as: **Target installed APK: 0.1.0 (5) · OTA runtime: 0.1.0**.
8. A runtime `0.2.0` preview OTA may exist for development, but it must never be reported as delivery to the user's installed Partner APK `0.1.0 (5)`.

## Change-control note

If the user later explicitly confirms installation of a newer Partner APK, update this file, `AGENTS.md`, and the mobile Expo handoff together before using the newer runtime as the delivery target.
