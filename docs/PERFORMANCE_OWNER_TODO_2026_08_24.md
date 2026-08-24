# Performance Owner To-Do

1. Sign in to the audit Chrome tab so authenticated page/button/upload/download timings can be recorded.
2. Approve a **preview-only** `icn1` region test; do not change production first.
3. Review the preview metrics and authorize production only if p75/p95 improve and workflows pass.
4. Choose the first paginated register: **Customers** is recommended.
5. Schedule a database maintenance window for tested RLS/index migrations.
6. Say **deploy now** only after the feature PR and canonical verification gate are green.

Do not manually change Supabase region, RLS policies, indexes, storage rules, or Vercel production region outside this staged plan.
