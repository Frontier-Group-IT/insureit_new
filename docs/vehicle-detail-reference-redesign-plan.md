# Customer Vehicle Detail reference redesign

This branch implements the Customer App Vehicle Detail redesign requested on 2026-10-03.

Target UI changes:
- Light vehicle summary hero with vehicle image, registration number, model, expiry badge, insurer/policy type/expiry summary.
- Separate protection-status strip with renewal/add-policy action.
- Expandable Alerts and dues card with per-item rows and expired/renewal-due counts.
- Segmented tabs for Vehicle Details, Documents, and History.
- Reference-style Vehicle details card with Edit action, two-column icon grid, subtle dividers, and continued rendering of all existing vehicle/compliance fields.
- Preserve existing data sources, actions, navigation, masking, permissions, and business logic.
- Preserve the established 45-day renewal-due window for policy/compliance alerts.
- No APK/AAB build requested.
