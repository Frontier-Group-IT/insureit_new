# Claim Tracker UI Handoff — 2026-08-25

## Purpose

This is the durable implementation context for the current External Claim Tracker UI refinement. It records the user-approved UI decisions from the 2026-08-25 Claim Tracker work without storing the raw chat transcript.

## Current approved header

The External Claim Tracker heading must be compact and consistent:

- Eyebrow: `EXTERNAL CLAIM`
- Main title: `Claim Tracker`
- Right side: `Self Tracked` compact status chip
- Right side: icon-only `Get Assistance` control using the user-provided assistance icon style
- Do not display the `Get Assistance` text permanently in the header.

## Claim Tracker layout rules

- Remove the segmented 9-stage progress strip from the top of the Claim Tracker page; it is redundant with the claim progress indicator.
- Keep the claim progress ring inside the primary blue claim card, but use the compact version approved by the user: approximately 50% of the earlier displayed size.
- Keep the primary claim identity card compact and information-dense.
- The expanded `Claim details` information must be visually distinct from the primary claim card. Do not render both the primary card and its expanded details as the same navy-on-navy surface. Use a clearly contrasting lighter secondary surface for the details area while preserving the existing information hierarchy and accessibility.
- The `Current Milestone` card is a navigation control. The entire card must be clickable and must invoke the same current-stage/next-stage navigation behavior as the former `Proceed to Next Step` action.
- The milestone card should communicate the action with a compact `Continue` affordance and chevron.
- Avoid duplicating the same navigation action in a separate large `Proceed to Next Step` button when the milestone card already performs it.
- Keep Get Assistance as a secondary action and use the icon-only header control to reduce vertical space where the current workflow permits it.
- Keep the assistance flow itself unchanged unless the user explicitly requests a behavior change.

## Claim Journey compaction

- The `Claim Journey` section should be substantially more compact to reduce mobile scrolling.
- Reduce the journey header height/padding.
- Reduce milestone row height, vertical gaps, and oversized status indicators while retaining readability.
- Preserve stage title, concise subtitle/status, date when available, current-stage indication, and navigation affordances.
- Do not remove milestone functionality merely for visual compaction.

## Design consistency

The page should use the same compact insurance-operations visual language already approved for the mobile claim journey:

- Primary claim identity: dark navy.
- Secondary/details and navigation surfaces: light backgrounds with restrained blue accents.
- Rounded cards with controlled padding and minimal decorative bulk.
- Clear distinction between primary information, secondary metadata, and actionable controls.
- Avoid redundant progress indicators, duplicated navigation controls, and repeated claim identifiers.

## Verification expectations

For future changes to this area:

1. Inspect the current `main` implementation before editing; do not reconstruct older Claim Tracker layouts from screenshots.
2. Preserve existing claim business logic, assistance workflow, stage navigation, permissions, and data behavior unless explicitly requested otherwise.
3. Verify the affected mobile screen visually on the installed Expo preview app after an approved preview OTA publication.
4. Treat an Expo OTA publication as separate from source implementation: the installed device must be verified against the exact published update.
5. Do not create an APK for JS/layout-only changes unless explicitly requested.

## Related implementation landmark

PR #612 was the cumulative mobile Claim Tracker refinement that introduced the compact one-row claim header, icon-only Get Assistance placement, clickable Current Milestone navigation, removal of the redundant top tracker strip, and compact Claim Journey direction. It was merged before this handoff was recorded.

This handoff intentionally records the durable UI rules rather than the raw conversation history.
