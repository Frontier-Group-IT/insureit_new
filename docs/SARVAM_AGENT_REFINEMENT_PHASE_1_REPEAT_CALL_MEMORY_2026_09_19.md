# Sarvam Agent Refinement — Phase 1: Repeat-Call Memory

## Objective

The agent must recognize when it has already had a connected conversation with the same External Renewal prospect and continue that discussion rather than restarting discovery.

This phase deliberately does **not** persist raw Sarvam transcripts. It reuses the normalized information INSUREIT already stores for each connected voice attempt and sends a compact memory brief into the next Sarvam call.

## INSUREIT runtime variables added

Add these variables to the Sarvam agent under **Variables & personalization → Input variables**:

- `repeat_call`
- `previous_connected_call_count`
- `last_call_date`
- `last_call_disposition`
- `last_customer_interest`
- `last_customer_objection`
- `last_follow_up_time`
- `last_call_summary`
- `previous_conversation_context`
- `opening_line`

All values are supplied by INSUREIT at cohort dispatch time.

For privacy/logging, flag `last_call_summary`, `last_customer_objection`, and `previous_conversation_context` as PII-sensitive where the Sarvam UI permits it.

## Greeting change

Replace the current fixed greeting:

```text
Namaste customer_name ji, main INSUREIT se bol raha hoon aapki vehicle_make_model ki policy renewal ke baare mein. Kya do minute baat kar sakte hain?
```

with the single variable:

```text
opening_line
```

Insert it using Sarvam's variable picker so the greeting is populated from the campaign row.

INSUREIT now generates two styles:

### First connected conversation

```text
Namaste Rajesh ji, main INSUREIT ka automated renewal assistant bol raha hoon, aapki Scorpio N ki policy renewal ke regarding. Kya do minute convenient hain?
```

### Repeat conversation

Generic continuation:

```text
Namaste Rajesh ji, main INSUREIT ka automated renewal assistant bol raha hoon. Pichli baar hum aapki policy renewal par baat kar chuke hain. Main wahi discussion continue karne ke liye call kar raha hoon—abhi do minute convenient hain?
```

When the previous disposition is specific, INSUREIT makes the continuity more relevant, for example:

- prior follow-up → "Pichli baar aapne baad mein baat karne ko kaha tha..."
- prior quote request → "Pichli baar hum renewal quotation aur options ko lekar baat kar rahe the..."
- prior interested → "Pichli baar hum aapki renewal requirements par baat kar rahe the..."

No unsupported claim is made that a quote was prepared, callback was scheduled, or human action happened.

## Prompt patch to add near the top of the agent instructions

```text
CROSS-CALL MEMORY — HIGH PRIORITY

You may receive repeat_call, previous_connected_call_count,
last_call_date, last_call_disposition, last_customer_interest,
last_customer_objection, last_follow_up_time, last_call_summary,
previous_conversation_context and opening_line from INSUREIT.

Use opening_line exactly once as the first spoken message.

If repeat_call = yes:
- This is a continuation, not a fresh sales call.
- Never restart the full first-call introduction.
- Never ask again for information already clearly present in previous_conversation_context or last_call_summary.
- Continue from the most useful unresolved point.
- If the customer requested a callback earlier, acknowledge that context briefly and continue.
- If the customer previously requested a quote/options, do not ask whether they want a quote again.
- If insurer preference, claim status, add-on requirements, price/coverage priority, objection, or preferred timing is already known, do not re-ask it.
- Do not read the memory summary aloud or list everything previously discussed.
- Mention prior context in one short natural sentence only when useful.
- Current-call corrections override prior memory immediately.

NAME DISCIPLINE
- The full customer name may appear only in identity-sensitive situations.
- Normally the opening uses first name + ji.
- After the opening, avoid using the name repeatedly; maximum one additional natural use in a normal call.
- Never use the name as a filler at the start of every response.
```

## Memory construction in INSUREIT

Before creating the new local voice attempt, INSUREIT loads up to five prior attempts where `connectivity_status = connected`.

The current call receives:
- the previous connected-call count;
- the latest disposition, interest, objection, follow-up time and summary;
- a concise context string covering up to the three most recent connected conversations.

No-answer, busy and failed attempts do not make a customer a "repeat conversation" because no meaningful conversation occurred.

The exact repeat-call context is also included in the attempt's existing `cohort_context` snapshot so IT can inspect what the agent knew at dispatch time.

## Why this is Phase 1 only

The existing output variables capture outcome, interest, objection, callback and a short summary, but they do not yet capture every sales preference in a structured form.

Phase 2 will add richer output memory such as:
- preferred insurer;
- same-insurer vs compare-options preference;
- claim status;
- premium-vs-coverage priority;
- requested add-ons;
- questions already answered;
- human-transfer preference;
- agreed next action.

Those output variables will then feed this same repeat-call memory pipeline automatically.
