from pathlib import Path

workflow = Path('.github/workflows/publish-mobile-preview-ota.yml')
text = workflow.read_text()
old_if = "    if: github.event_name == 'workflow_dispatch' || contains(github.event.head_commit.message, '#547')\n"
new_if = "    if: github.ref == 'refs/heads/main'\n"
if old_if in text:
    text = text.replace(old_if, new_if, 1)
elif new_if not in text:
    raise SystemExit('Expected Expo preview job guard was not found')

checkout = """      - name: Check out merged source
        uses: actions/checkout@v4
        with:
          ref: main

"""
guarded_checkout = """      - name: Check out merged source
        uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - name: Verify OTA source is exact current main
        shell: bash
        run: |
          set -euo pipefail
          git fetch origin main
          current_head=\"$(git rev-parse HEAD)\"
          remote_main=\"$(git rev-parse origin/main)\"
          if [ \"$current_head\" != \"$remote_main\" ]; then
            echo \"Refusing Expo preview OTA: checked-out source is not current origin/main.\" >&2
            echo \"HEAD=$current_head\" >&2
            echo \"origin/main=$remote_main\" >&2
            exit 1
          fi

"""
if 'Verify OTA source is exact current main' not in text:
    if checkout not in text:
        raise SystemExit('Expected checkout block was not found')
    text = text.replace(checkout, guarded_checkout, 1)

text = text.replace('--message "Block duplicate active self-tracked claims" \\\n', '--message "Expo preview from main ${GITHUB_SHA}" \\\n', 1)

summary_anchor = "            '| Expo channel | `preview` |',\n"
summary_line = "            '| Source policy | `current main only` |',\n"
if summary_line not in text:
    if summary_anchor not in text:
        raise SystemExit('Expected OTA summary anchor was not found')
    text = text.replace(summary_anchor, summary_anchor + summary_line, 1)
workflow.write_text(text)

agents = Path('AGENTS.md')
agents_text = agents.read_text()
marker = '### Expo preview OTA source-of-truth protocol'
if marker not in agents_text:
    agents_text += """

### Expo preview OTA source-of-truth protocol

**MANDATORY FOR ALL AGENTS:** the shared Expo `preview` channel is a single moving OTA target. Its authoritative source is the exact current `main` commit.

- Only `.github/workflows/publish-mobile-preview-ota.yml` may publish to Expo channel `preview`.
- The workflow must run from `refs/heads/main`, check out `main`, fetch `origin/main`, and refuse publication unless checked-out HEAD exactly equals current `origin/main`.
- Never publish a feature branch, PR branch, recovery branch, temporary branch, or local worktree directly to the shared `preview` channel. Expo OTAs do not layer branch snapshots; the newest compatible OTA can make earlier changes appear reverted.
- Merge approved mobile work in controlled phases. Refresh each phase against current `main`, resolve overlaps, pass canonical CI, merge, verify the exact resulting `main`, then publish that exact `main` commit to `preview`.
- When a cumulative recovery PR supersedes several feature PRs, merge only the cumulative PR and close the source PRs as superseded after verification. Do not merge the same changes twice.
- Feature/recovery branches may use CI, Expo web review exports, screenshots, or other non-OTA review methods, but must not publish to shared `preview`.
- If preview appears to lose approved work, compare the served OTA source with current `main`; restore/merge approved code into `main`, verify it, then republish from `main`. Do not repair by sending another isolated branch to `preview`.
- JS/assets-only OTA publishing must not create an APK. Native/runtime/build-profile changes require separate explicit approval.
- Do not change Expo app version, runtimeVersion, EAS channel/build configuration, project ID, owner, package/bundle IDs, or other protected mobile configuration merely to solve OTA ordering.
"""
    agents.write_text(agents_text)

handoff = Path('docs/CURRENT_CHAT_HANDOFF.md')
handoff_text = handoff.read_text()
handoff_marker = '## 2026-08-25 phased mobile merge and main-only Expo preview plan'
if handoff_marker not in handoff_text:
    handoff_text += """

## 2026-08-25 phased mobile merge and main-only Expo preview plan

**USER-APPROVED OPERATING DECISION:** the shared Expo `preview` channel must now be sourced only from the exact current `main` commit. Isolated feature/recovery/PR branches must no longer publish directly to `preview`.

**LEARNING:** Expo `preview` is a moving channel, not a stack of branch updates. Publishing #588, #593, #595, #603, #607, #612, or any other branch directly to the same channel can replace the cumulative snapshot and make earlier work appear reverted even when Git history is intact.

### Phased merge plan

1. **Phase 0 — deployment guard.** Merge the main-only Expo preview workflow/documentation PR first. It must reject non-`main` refs and verify checked-out HEAD equals `origin/main` before `eas update --channel preview`.
2. **Phase 1 — refresh cumulative recovery.** Refresh PR #612 (`recovery/mobile-today-cumulative`) against the then-current `main`, resolve overlaps with later merges, and rerun required mobile/web CI. Do not merge #588/#593/#595/#603/#607 separately.
3. **Phase 2 — merge cumulative recovery.** Merge #612 only when refreshed, green and mergeable; verify the exact resulting `main` commit.
4. **Phase 3 — authoritative OTA.** Publish the exact verified `main` commit to Expo `preview`. OTA only for JS/assets changes; no APK. Confirm Expo publish success/channel mapping before claiming the installed preview is restored.
5. **Phase 4 — close superseded PRs.** Close #588, #593, #595, #603 and #607 as superseded by #612 after Phase 3 verification.
6. **Phase 5 — independent remaining work.** Handle unrelated PRs separately, refreshed against current `main` with their own CI. Web-only merges need no mobile OTA; mobile-affecting merges follow the same main-only preview rule.

At this handoff update, `main` had advanced beyond the original #612 base, so #612 must be refreshed before any merge. No direct production-data, Supabase schema/RLS/auth, Expo runtime/version/build-profile, or APK change is part of this plan.
"""
    handoff.write_text(handoff_text)
