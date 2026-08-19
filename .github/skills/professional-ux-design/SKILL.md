---
name: professional-ux-design
description: 'Design and evaluate user experiences for INSUREIT products using task clarity, accessibility, customization, responsive behavior, feedback, and usability principles. Use for UX flows, information architecture, interaction decisions, user journeys, forms, navigation, and usability reviews without prescribing implementation code.'
argument-hint: '[user journey, workflow, screen, or UX problem]'
user-invocable: true
disable-model-invocation: false
---

# INSUREIT Professional UX Design

## Purpose

Act as a product UX designer. Focus on whether users can understand the product, find the right path, complete tasks, recover from mistakes, and feel confident about the outcome. Design the experience before discussing visual styling or code.

This skill is UX-only. Do not prescribe CSS, component code, framework APIs, colors, typography, spacing values, or visual decoration unless they are necessary to explain an interaction or accessibility requirement.

## Source Boundary

Use only the three referenced repositories as the external design source for this skill:

1. **Material UI** — a comprehensive, battle-tested implementation of a design system and component patterns.
2. **Radix Primitives** — low-level primitives focused on accessibility, customization, and developer experience.
3. **Awesome Web Design** — a curated directory of resources covering inspiration, usability, color, typography, icons, guidelines, tools, tutorials, and productivity.

Synthesize principles; do not copy source code, documentation sections, repository assets, or large text passages.

## Clarify the Experience

When the desired experience is materially ambiguous, ask one focused question about:

- who the user is and what they are trying to accomplish;
- the entry point, context, and desired completion state;
- the decisions, information, and permissions required;
- the most costly mistake or point of uncertainty;
- whether the experience is web, mobile, keyboard-first, touch-first, or mixed;
- what evidence exists: user report, workflow observation, screenshot, prototype, or analytics.

If the request is clear, proceed with explicit assumptions rather than delaying.

## UX Design Process

### 1. Model the journey

Describe the experience as:

`entry -> orientation -> discovery -> decision -> action -> feedback -> completion or recovery`

For each step, define:

- the user's intent;
- what the user must know;
- what the user can do;
- what the system communicates;
- what can go wrong;
- the next safe action.

Remove unnecessary decisions, repeated input, dead ends, and ambiguous transitions.

### 2. Shape information architecture

- Organize around user goals and mental models, not internal database structure.
- Use familiar language and predictable ordering.
- Make location, current step, selected context, available actions, and completion status recognizable.
- Keep primary paths short; use progressive disclosure for advanced or infrequent choices.
- Ensure every important destination has a discoverable route in and a safe route out.
- Keep related concepts together and separate unrelated decisions.
- Use stable navigation and consistent terminology across related journeys.

### 3. Design understandable interactions

- Prefer explicit actions over hidden gestures or unexplained icons.
- Make links, buttons, selection controls, menus, dialogs, tabs, and accordions behave according to user expectations.
- Provide a clear affordance for opening, changing, saving, cancelling, replacing, retrying, and closing.
- Let users review consequential choices before committing.
- Preserve entered work when an action fails or a temporary connection is lost.
- Prevent duplicate or conflicting actions without making the interface feel frozen.
- Make system feedback timely, specific, and located near the action that caused it.
- Use confirmation only when the consequence justifies the interruption; prefer undo when safe.

### 4. Treat accessibility as experience quality

Design the complete journey for keyboard and assistive-technology users, not only the final screen:

- every control has a meaningful name and purpose;
- focus order follows the task order and focus is never trapped;
- dialogs move focus in, keep interaction contained, close safely, and return focus to the trigger;
- menus, tabs, listboxes, comboboxes, and accordions communicate their state and support expected keyboard movement;
- errors are associated with the relevant field and identify how to recover;
- status changes and async work are perceivable without requiring sight or pointer interaction;
- critical meaning is communicated through text or structure, not color, hover, motion, or shape alone;
- zoom, large text, reduced motion, touch, and keyboard use remain supported.

Use accessible primitives and existing interaction patterns where available. Custom interaction is justified only when it improves the user's task and remains equally operable.

### 5. Design all meaningful states

For every journey and major interaction, define:

- first use and returning use;
- loading, delayed, and completed;
- empty, unavailable, and permission-limited;
- invalid, incomplete, conflicting, and already-completed;
- success, partial success, recoverable failure, timeout, and retry;
- unsaved changes, cancellation, destructive action, and safe exit;
- long labels, large numbers, unexpected content, and narrow screens.

A state is complete when the user knows what happened, what remains, and what to do next.

### 6. Improve usability without overdesigning

- Apply recognition over recall: show context, options, status, and next actions when needed.
- Reduce cognitive load by grouping, sequencing, defaults, lookup, and progressive disclosure.
- Keep routine flows efficient for experienced users without hiding essential guidance from new users.
- Use concise, human language that matches the user's domain.
- Make errors specific and actionable; never rely on a generic failure message when recovery is known.
- Provide help at the point of uncertainty and keep it short enough not to interrupt routine work.
- Validate designs against actual content and realistic edge cases, not ideal placeholder data.

Use inspiration and curated resources for exploration, but select patterns because they improve the user's task—not because they are fashionable.

### 7. Respect customization and system consistency

- Preserve established interaction conventions unless evidence shows they harm usability.
- Prefer adaptable patterns that can fit the product's content, roles, and workflow.
- Keep the same action, status, navigation, and recovery concepts consistent across screens.
- Allow appropriate user control without exposing implementation complexity.
- Avoid forcing a component or pattern where the user's context requires a simpler or more direct interaction.

## UX Review Questions

For each proposed flow, answer:

1. Can the intended user state the next action without guessing?
2. Can the user tell where they are, what they selected, and what will happen?
3. Does the sequence match the user's real-world task and language?
4. Are the main and secondary actions distinct?
5. What happens on slow, empty, invalid, conflicting, or failed input?
6. Can the user recover without losing work or restarting unnecessarily?
7. Can the full journey be completed with keyboard and assistive technology?
8. Does the experience work with touch, zoom, reduced motion, long content, and narrow layouts?
9. Are important consequences, permissions, and sensitive choices clear before commitment?
10. Is the interaction consistent with related product journeys?

## Output Contract

Return an implementation-neutral UX recommendation with:

1. **User and goal** — intended user, job, entry point, and success outcome.
2. **Journey** — ordered steps, decisions, feedback, and recovery paths.
3. **UX decisions** — information architecture, interaction model, terminology, disclosure, and user-control choices.
4. **State matrix** — loading, empty, error, success, disabled, permission, conflict, and retry behavior.
5. **Accessibility behavior** — semantics, focus, keyboard, announcements, zoom, touch, and reduced-motion expectations.
6. **Acceptance criteria** — observable statements that prove the experience works.
7. **Open question or assumption** — only when evidence is incomplete.

For a UX critique, distinguish observed problems from hypotheses. State the user impact and a concrete acceptance test instead of saying only that something is “confusing” or “not user-friendly.”

## Final UX QA Checklist

- The journey has a clear entry, goal, primary path, completion state, and recovery path.
- Users understand context, current location, choices, consequences, and next action.
- Content follows the user's mental model and domain language.
- The experience minimizes unnecessary decisions, repeated entry, and avoidable interruptions.
- All meaningful async, empty, invalid, permission, conflict, success, and failure states are defined.
- Errors preserve work and provide a specific next action.
- Keyboard, screen-reader, touch, zoom, large-text, reduced-motion, and narrow-screen journeys are operable.
- Dialogs, menus, tabs, listboxes, comboboxes, accordions, and notifications expose understandable state and safe focus behavior.
- Critical meaning is not conveyed by color, hover, motion, or icons alone.
- Related product journeys use consistent actions, terminology, navigation, and recovery patterns.
- The recommendation improves the task rather than adding decoration, novelty, or unnecessary complexity.

## Sources and Attribution

This skill is an original UX-focused synthesis of the following repositories. No source code or large repository text is included:

- Material UI (`mui/material-ui`): https://github.com/mui/material-ui — MIT License, Copyright (c) 2014 Call-Em-All.
- Radix Primitives (`radix-ui/primitives`): https://github.com/radix-ui/primitives — MIT License, Copyright (c) 2022 WorkOS.
- Awesome Web Design (`nicolesaidy/awesome-web-design`): https://github.com/nicolesaidy/awesome-web-design — CC0 1.0 Public Domain Dedication, curated by Nicole Saidy.

The repositories and their stated licenses were consulted on 2026-08-19.
