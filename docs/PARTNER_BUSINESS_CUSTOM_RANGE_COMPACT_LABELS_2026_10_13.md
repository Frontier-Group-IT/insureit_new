# Partner Business custom range and compact KPI labels — 2026-10-13

Branch: `fix/partner-business-custom-close-single-line-kpis-20261013`

- Business Overview custom range: on successful `PartnerBusinessRangeSummaryCard.onApplied`, update the existing selected range state and close the custom range panel.
- Month-wise Trend custom range: same successful-apply behavior, preserving selected trend data.
- Failed range requests already remain in the date-picker panel and display an error; this change does not close failed requests.
- All four Business Overview KPI labels now render on one line via `numberOfLines={1}` and `adjustsFontSizeToFit`, reduced horizontal padding and compact font sizing. Existing values, trends, navigation targets, backend calls and authorization unchanged.
- Validation required: open each Custom selector, choose a valid From/To, apply and observe panel dismiss and updated data; simulate API failure and confirm panel remains open; test one-line labels on small-screen Android.
- No SQL/database changes, PR, merge, OTA, APK or AAB.
