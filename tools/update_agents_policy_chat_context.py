from pathlib import Path

path = Path("AGENTS.md")
text = path.read_text()
marker = "## Current INSUREIT implementation context — 2026-08-07"
heading = "### Additional approved Policy Onboarding decisions from AuthBridge integration work"

if heading in text:
    raise SystemExit("Additional Policy Onboarding context already present")
if marker not in text:
    raise SystemExit("Current INSUREIT context marker not found")

block = '''### Additional approved Policy Onboarding decisions from AuthBridge integration work

- **VERIFIED CURRENT ROUTE:** `/policies/new` now renders `PolicyUnifiedForm` from `apps/web-portal/components/policy-unified-form.tsx`. Older iterations used `policy-form-authbridge.tsx`; future agents must always trace the current route import before editing because similarly named legacy components remain in the repository.
- **LEARNING:** a previous production deployment showed no visible Add Policy changes because edits were made to `policy-form.tsx` while the route rendered another component. Never assume a component is live from its name alone; verify route → import → rendered component before editing and before debugging a deployment.
- Section 01 uses the user-facing label **Policy Type**, not Business Line.
- Intermediary Type is limited to `POSP`, `MISP`, and `SIBL / Partner`; `Direct` was intentionally removed and must not be restored without explicit approval.
- The main Policy Onboarding page intentionally excludes billing/reconciliation controls. Do not restore Pay-in Bill Number, Pay-in Billed Amount, Pay-in Bill Date, Pay-in Status, or Short Payout there; billing is reserved for a separate workflow/page to be designed later.
- `Retention` belongs with **Projected insurer pay-in**, not the Partner/Intermediary payout section.
- `OD / NET basis` was intentionally removed from the visible Projected insurer pay-in section. Internal legacy state may still exist for compatibility/calculation logic; do not re-expose the field without approval.
- The right-side **Live Summary / Policy Intelligence** area must stay visible while the user scrolls on desktop. Preserve sticky/fixed-with-boundary behavior without allowing it to overlap the page header or fixed bottom actions. Other sidebar/supporting cards should not be made sticky merely because the financial summary is sticky.
- AuthBridge RC review may show and apply full chassis and engine numbers in this authenticated internal portal. Do not mask them in the approved Policy Onboarding review/application flow solely because they are chassis/engine identifiers. This does not relax the rule against logging or committing real provider/customer values.
- The verified Detailed RC provider structure groups data under `data.msg` sections `Registration Details`, `Vehicle Details`, `Owners Details`, `Insurance Details`, `Hypothecation Details`, and `RC Status`. Prefer these exact section/key mappings over guessed aliases.
- Important RC fields used by the policy workflow include manufacturer, model, fuel, manufacture date/year, engine capacity/CC, seating capacity, GVW/gross weight, unladen weight, vehicle category/class, chassis, engine, RTO/state, registration/fitness/tax status, insurance reference data, hypothecation, PUC and permit details when returned.
- Capacity mapping remains class-dependent: PCP/TWP → Engine Capacity/CC; PCV → Seating Capacity; GCV → GVW/Gross Weight; MISD → Category then CC/GVW fallback; CPM → equipment/GVW fallback unless a more specific approved mapping is introduced.
- AuthBridge lookup must remain explicit and review-before-apply. Existing manual values are preserved unless the user resolves a conflict/replacement; existing RC insurance remains reference-only for the new policy.

'''

path.write_text(text.replace(marker, block + marker, 1))
