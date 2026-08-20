# Source Influences and Licensing Approach

This InsureIt skill is original project documentation. It synthesizes general principles learned from public mobile-design and React Native resources without copying unlicensed external skill text into this repository.

## Public references reviewed

### awesome-skills/mobile-app-design

Useful influence areas:

- cross-platform mobile accessibility
- touch-target ergonomics
- contrast and typography checks
- common mobile interaction mistakes
- React Native performance awareness

Repository metadata reviewed in August 2026 did not declare a license. Treat it as a conceptual research source only; do not copy its prose/code into InsureIt without separate permission/license confirmation.

### ceorkm/mobile-app-ui-design

Useful influence areas:

- user-goal-first design
- hierarchy before decoration
- relationship-based spacing
- restrained visual systems
- finance/productivity design expectations

Repository metadata reviewed in August 2026 did not declare a license. Treat it as a conceptual research source only.

### yue1123/apple-hig-skills

Useful influence areas:

- platform-native interaction expectations
- accessibility and recovery from mistakes
- form/data-entry ergonomics
- safe areas, touch behavior and semantic controls

Repository metadata reviewed in August 2026 did not declare a license. Apple-specific visual rules are not adopted as universal cross-platform InsureIt rules.

### google-labs-code/stitch-skills

Useful influence areas:

- React Native implementation discipline
- theme/token extraction
- semantic component boundaries
- accessibility metadata
- responsive layout
- separation between visual design and implementation

Repository declares Apache License 2.0. The InsureIt skill still uses original project-specific wording and does not depend on Stitch tooling.

## InsureIt-specific additions

The most important rules in this skill come from the product itself:

- serious fleet/insurance operational tone
- density levels D1/D2/D3
- value > context > label for many operational values
- business/event date distinct from audit/save timestamp
- chronological workflow validation
- primary-amount financial progression
- claims/policies/vehicles hierarchy
- no silent overwrite from provider/OCR data
- preservation of existing Expo/React Native architecture and protected configuration

These rules should evolve from verified InsureIt product learnings rather than generic trend guidance.

## Maintenance rule

When adding a new external influence:

1. record the repository/source
2. check its license
3. extract concepts, not copyrighted prose, unless the license and attribution requirements permit reuse
4. resolve any conflict in favor of InsureIt business correctness, accessibility and existing architecture
5. add only durable rules that improve future design decisions
