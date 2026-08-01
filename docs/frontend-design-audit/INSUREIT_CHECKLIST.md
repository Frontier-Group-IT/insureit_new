# InsureIt Frontend Audit Checklist

Use this file during every frontend audit. Evaluate all 15 principles. For each principle, record a finding, a strength, or a limitation.

## 1. Visibility of system status

Check whether users always know what the system is doing.

InsureIt examples:

- PAN/IIB verification shows waiting, running, matched, not found, failed, and retry states.
- File uploads show selected, uploading, uploaded, rejected, and replacement states.
- Save/create/invite buttons disable while processing and show progress.
- Bulk import shows parsing, validation, processing, partial success, and completion.
- Current workflow stage, account status, active filters, selected tab, and next action are visible.
- Success and failure feedback appears near the action and remains long enough to understand.

High-risk defects:

- user can double-submit onboarding or account creation;
- background process appears frozen;
- account status changes without confirmation;
- destructive or financial action gives no outcome.

## 2. Match between system and the real world

Use language and ordering that match insurance operations, not database or developer terminology.

Check:

- raw values such as `iib_registered`, `pending_review`, UUIDs, HTTP codes, and stack messages are translated into readable labels;
- dates, currency, phone numbers, and identifiers use Indian conventions where appropriate;
- fields follow the order staff naturally collect information;
- button labels describe user goals: “Create POSP account,” not merely “Submit”;
- POSP, MISP, DP, Partner, RM, IIB, training, exam, and agreement terms are used consistently and only where appropriate;
- icons do not require users to guess unfamiliar insurance concepts.

## 3. User control and freedom

Check:

- every multi-step workflow has Back and a safe exit;
- modal, drawer, menu, and preview states can be closed by visible control and keyboard;
- users can cancel file selection or replace the wrong document;
- unsaved long forms warn before leaving or preserve a draft;
- destructive actions require confirmation or support undo;
- users can return from workflow screens to the same account context;
- retries do not create duplicate accounts, records, or invitations.

## 4. Consistency and standards

Check across all intermediary, customer, policy, vehicle, and claim screens:

- identical actions use identical labels, button hierarchy, icons, and placement;
- POSP/MISP/Partner terms and stage labels are stable across register, workflow, review, and portal screens;
- one icon family is used, with standard sizes and stroke weights;
- status colours have stable meanings;
- cards, tables, filters, dialogs, page headers, empty states, and notices share reusable patterns;
- links navigate and buttons perform actions;
- spacing, typography, radii, shadows, and transition timings follow a shared scale.

## 5. Error prevention

Check:

- PAN, Aadhaar, GST, IFSC, phone, email, date, quantity, and identifier constraints are validated early;
- sensitive numbers are not accepted in visibly invalid formats;
- required documents are calculated correctly for account type and GST state;
- duplicate PAN/account/application creation is prevented;
- end dates cannot precede start dates;
- submit buttons cannot be clicked repeatedly during processing;
- high-impact actions show consequences before confirmation;
- permission-gated actions are hidden or disabled and also rejected server-side;
- Partner accounts never receive POSP/MISP qualification requirements by mistake.

## 6. Recognition over recall

Check:

- users can see the account type, current stage, status, assigned RM, and next action without remembering a previous screen;
- breadcrumbs or stable return links exist in deep workflows;
- selected customer, machine, intermediary, policy, or document context remains visible;
- search and autocomplete replace memorising IDs;
- previous values are prefilled where safe;
- empty states explain why the list is empty and what to do next;
- document requirements are visible before submission;
- tooltips supplement visible labels rather than hiding critical instructions.

## 7. Flexibility and efficiency

Check:

- frequent users can search, filter, sort, and use bulk operations;
- tables support efficient scanning and, where useful, column controls or saved filters;
- keyboard users can complete primary workflows;
- repeated data entry is reduced through defaults, lookup, and prefill;
- bulk import provides downloadable error details and supports correcting only failed rows;
- responsive layout does not force desktop-only interactions;
- motion respects reduced-motion preferences;
- advanced controls do not obstruct novice users.

## 8. Aesthetic and minimalist design

Check:

- one clear primary action dominates each screen region;
- secondary and destructive actions are visually subordinate;
- metadata is quiet, while names, statuses, totals, and required actions are prominent;
- dense enterprise screens remain scannable without turning every section into a card;
- content is grouped by user task, not database table;
- progressive disclosure hides rarely used detail without hiding required information;
- typography has a clear page-title, section-title, body, label, and metadata scale;
- section spacing is larger than within-group spacing;
- colour communicates purpose rather than decoration;
- visual assets support understanding and do not compete with operational data.

## 9. Error recovery

Check:

- error messages say what failed, why when known, and what the user can do next;
- validation appears beside the affected field and focus moves to the first problem;
- entered data remains intact after failure;
- retry is available for transient PAN/IIB, upload, invitation, and network failures;
- partial bulk-import success clearly separates successful and failed rows;
- permission errors explain the required role or next contact;
- generic “Something went wrong” messages are avoided when a specific recovery path exists.

## 10. Help and documentation

Check:

- unfamiliar concepts have concise contextual help;
- document upload cards state accepted formats, limits, and required/optional status;
- training/exam/agreement steps explain prerequisites and completion criteria;
- destructive and irreversible actions explain consequences;
- empty states teach the next action;
- bulk templates and error files are discoverable;
- help does not overwhelm routine workflows.

## 11. Affordances and signifiers

Check:

- clickable elements look clickable, and static cards do not imitate interactive cards;
- icon-only buttons have accessible names and visible tooltips on pointer devices;
- primary, secondary, tertiary, and destructive actions are visibly distinct;
- hover, focus, active, selected, loading, and disabled states are clear;
- external links indicate they open another system when relevant;
- touch targets are comfortably sized;
- file drop zones and upload controls clearly indicate interaction;
- status chips are not mistaken for buttons.

## 12. Structure

Check:

- pages have one clear purpose and heading;
- related fields are grouped into meaningful sections;
- account review is separated from onboarding workbench actions;
- POSP/MISP qualification stages are not shown for Partner accounts;
- overview, identity, compliance/documents, onboarding, business, portal access, and activity information have stable structure;
- table headers, grouped rows, and responsive transformations preserve relationships;
- mobile navigation does not hide the user’s location;
- section boundaries are visible through spacing, dividers, or background—not excessive decoration.

## 13. Accessibility

Check:

- semantic landmarks and heading hierarchy;
- visible labels for form fields;
- meaningful alt text or empty alt for decorative images;
- full keyboard operation of primary workflows;
- visible focus indicators;
- accessible dialog, menu, tab, accordion, and toast patterns;
- error association with `aria-describedby` and `aria-invalid`;
- live announcements for async status when useful;
- sufficient colour contrast;
- information is never conveyed by colour alone;
- zoom is not disabled;
- tables, labels, values, and statuses have programmatic relationships.

## 14. Perceptibility

Check:

- important status differences are obvious at a glance;
- current step, required action, and selected state do not depend on subtle colour shifts;
- text is readable at normal zoom and metadata is not excessively small;
- visual hierarchy supports scanning before detailed reading;
- badges, icons, text, and position provide redundant signals for critical state;
- long names, identifiers, and error messages wrap without hiding controls;
- content does not shift unexpectedly while images or data load.

## 15. Tolerance and forgiveness

Check:

- inputs accept reasonable formatting differences and normalize them safely;
- users can correct mistakes without restarting the workflow;
- form data survives recoverable errors;
- duplicate clicks and retries are idempotent where necessary;
- imported files can contain partial errors without losing valid work;
- users receive confirmation before irreversible actions;
- timeouts or expired links provide a clear resend/restart path;
- optional fields truly remain optional.

# InsureIt domain gates

These checks supplement the 15 principles and can independently create severity 4 findings.

## Sensitive identity data

- Mask Aadhaar, PAN, bank account, and other sensitive data in summaries, tables, logs, screenshots, and notifications.
- Do not place full sensitive values in URLs, client logs, toast messages, or analytics events.
- Document preview and download permissions must match the user’s role.

## Role and permission integrity

- A hidden button is not authorization; server actions must verify roles.
- Actions shown to branch, RM, manager, admin, and intermediary users must match their permissions.
- Error and empty states must not leak the existence of records the user cannot access.

## Workflow correctness

- Partner onboarding is a two-stage path: primary/PAN and documents/account review.
- New POSP/MISP onboarding includes qualification stages as defined by the product workflow.
- Existing POSP import skips new qualification but still requires document and account review.
- Matched-PAN route choices must remain explicit: import existing, create Partner, or do not proceed.
- Next-action cards must be resolved from server state and route to the exact stage.

## Auditability and trust

- Important actions should show who performed them and when where operationally useful.
- Status changes should not silently overwrite prior outcomes.
- Success messages should include the created account or identifier when safe.

# Severity anchors for InsureIt

- **4:** sensitive data exposed; unauthorized action possible; primary onboarding/account task blocked; wrong account type or irreversible duplicate record created.
- **3:** missing feedback causes duplicate submission; required workflow step is confusing or inaccessible; errors erase entered data; status or next action is materially misleading.
- **2:** inconsistent labels/patterns, weak hierarchy, missing guidance, poor keyboard efficiency, or recurring but bypassable friction.
- **1:** visual polish defect with no meaningful task impact.
