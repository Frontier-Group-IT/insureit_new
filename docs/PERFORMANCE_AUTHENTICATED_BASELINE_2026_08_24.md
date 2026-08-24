# INSUREIT Authenticated Performance Baseline — 2026-08-24

## Scope and safety

This is the repository-owned authenticated appendix to the 24 August 2026 performance audit. Measurements used the signed-in production portal from India in read-only mode. No form was submitted, no workflow was advanced, and no record or file was created, changed, uploaded, or downloaded. Only aggregate timings and element counts were retained.

Live upload/download throughput remains intentionally untested. Run it only with synthetic files in an approved disposable tenant or test record.

## Direct protected-page loads

| Route | Run 1 | Run 2 | Mean |
|---|---:|---:|---:|
| Dashboard | 3.279 s | 3.246 s | 3.263 s |
| Customers | 5.725 s | 5.075 s | 5.400 s |
| Vehicles | 5.076 s | 6.458 s | 5.767 s |
| Policies | 7.008 s | 5.708 s | 6.358 s |
| Claims | 4.446 s | 5.973 s | 5.210 s |
| Tasks | 1.145 s | 1.712 s | 1.429 s |
| Reports | 2.388 s | 4.512 s | 3.450 s |
| Accounts | 1.487 s | 1.092 s | 1.290 s |

Authentication remained valid for every sample. Two runs per route are directional measurements, not field p75/p95 values or an SLA baseline.

Policies was slowest, followed by Vehicles, Customers, and Claims. Tasks and Accounts were materially faster. This variation supports a route/data-work problem rather than a universal browser or CDN problem.

## Interaction samples

- Workspace drawer, five cycles: approximately 344 ms to open and 341 ms to close.
- Successful sidebar click-to-route-settle samples: Customers 1.70 s, Reports 1.69 s, Accounts 3.00 s, Dashboard 4.12 s, Vehicles 2.89 s, Policies 2.88 s, and Tasks 3.05 s.
- The Claims sidebar sample was inconclusive because its target detached during a client-side transition; it is excluded rather than treated as a performance failure.

The drawer values include automation overhead and the intended transition. The route values are wall-clock diagnostics, not Interaction to Next Paint measurements.

## OCR Training

The OCR Training page took 4.09 s to settle and rendered 371 buttons and 328 links. This unusually large interactive DOM is evidence for pagination or virtualization, progressive disclosure, and on-demand detail loading. Expensive OCR actions must remain outside automatic prefetch.

## Plan impact

1. Keep the exact-revision preview-only `iad1` versus `icn1` comparison as the first infrastructure experiment.
2. Prioritize server pagination for Customers and Policies, plus pagination/virtualization for OCR Training.
3. After an explicitly authorized deployment of the merged Speed Insights patch, collect route-level p75/p95 field evidence.
4. Consolidate Dashboard, Policies, Vehicles, and Claims query work before optimizing routes already shown to be faster.
5. Test upload/download/OCR throughput only with synthetic files in an approved disposable tenant or record.
