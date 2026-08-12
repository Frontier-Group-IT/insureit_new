# INSUREIT Assistant Training

This directory contains the versioned behavior and evaluation assets for the OpenRouter-backed
assistant on `agent/assistant-preview`.

## Current integration

- Runtime constitution: `lib/assistant/constitution.ts`
- Foundation benchmark: `training/evals/foundation.jsonl`
- Regression validator: `scripts/assistant-training-regression.mjs`
- Full gate: `npm run assistant:regression`

The runtime remains provider-neutral and calls the configured OpenAI-compatible endpoint through
`lib/assistant/provider.ts`. The Preview environment currently supplies the OpenRouter endpoint,
key, and model through server-only environment variables.

## Training model

Facts and changing operational state are retrieved from permission-scoped approved knowledge or
trusted tools. They are not memorized in model weights. The system prompt trains stable behavior:
authorization discipline, source use, abstention, privacy, INSUREIT terminology, evidence-state
accuracy, prompt-injection resistance, and read-only tool boundaries.

Fine-tuning should begin only after retrieval quality is measured and a sufficiently large set of
reviewed, de-identified examples exists. Never place credentials, customer records, raw OCR text,
complete documents, provider responses, temporary URLs, or sensitive identity values in training
or evaluation data.

## Delivery sequence

1. Expand the foundation benchmark with approved domain and adversarial cases.
2. Publish reviewed knowledge through the existing controlled workbook workflow.
3. Measure permission-filtered retrieval recall and grounded-answer accuracy.
4. Add model-graded and deterministic answer checks without sending restricted data externally.
5. Pilot read-only behavior with internal employees and review failures.
6. Consider behavior fine-tuning only when it improves a measured baseline without reducing
   authorization, privacy, citation, or abstention performance.

## Release gates

- Factual answers cite an approved source.
- Unauthorized or sensitive disclosure remains zero in the benchmark.
- Unsupported questions abstain instead of guessing.
- A commit, migration, provider response, and deployment retain distinct evidence states.
- No consequential action can be executed by the Phase 1 assistant.
- Every prompt, provider, retrieval, knowledge, or model change reruns `assistant:regression`.

The JSONL benchmark is currently a contract dataset. It validates coverage and expected answer
properties; it is not yet an automated live-model score. Live-model evaluation must use a
sanitized Preview environment and record only approved metadata.
