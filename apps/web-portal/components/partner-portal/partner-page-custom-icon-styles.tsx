const customIconCss = String.raw`
/*
 * Partner page-content icon compatibility layer.
 *
 * Existing Partner pages use Lucide SVGs for semantic/decorative icons. This
 * layer keeps their layout, sizing, accessibility and utility controls intact,
 * but paints the approved optimized INSUREIT artwork into those SVG boxes.
 * Utility controls such as search, filter, arrows, chevrons, close, menu,
 * phone, mail and map-pin intentionally remain crisp vector controls.
 */
.partner-page-content svg.lucide-bar-chart-3,
.partner-page-content svg.lucide-chart-no-axes-column-increasing,
.partner-page-content svg.lucide-trending-up {
  background: url('/assets/Custom-Icons/optimized-128/reports-analytics.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-circle-dollar-sign,
.partner-page-content svg.lucide-receipt-indian-rupee,
.partner-page-content svg.lucide-badge-indian-rupee,
.partner-page-content svg.lucide-wallet-cards,
.partner-page-content svg.lucide-indian-rupee {
  background: url('/assets/Custom-Icons/optimized-128/accounts-finance.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-repeat-2,
.partner-page-content svg.lucide-refresh-cw,
.partner-page-content svg.lucide-calendar-clock,
.partner-page-content svg.lucide-calendar-sync {
  background: url('/assets/Custom-Icons/optimized-128/renewal.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-users-round,
.partner-page-content svg.lucide-users,
.partner-page-content svg.lucide-user-round-check {
  background: url('/assets/Custom-Icons/optimized-128/customers.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-user-round,
.partner-page-content svg.lucide-circle-user-round {
  background: url('/assets/Custom-Icons/optimized-128/partner-intermediary.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-file-text,
.partner-page-content svg.lucide-shield-check,
.partner-page-content svg.lucide-files,
.partner-page-content svg.lucide-file-check-2 {
  background: url('/assets/Custom-Icons/optimized-128/policy.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-file-input,
.partner-page-content svg.lucide-file-up,
.partner-page-content svg.lucide-upload,
.partner-page-content svg.lucide-clipboard-check {
  background: url('/assets/Custom-Icons/optimized-128/policy-intake.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-clipboard-list,
.partner-page-content svg.lucide-shield-alert,
.partner-page-content svg.lucide-clipboard-plus {
  background: url('/assets/Custom-Icons/optimized-128/claims.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-alert-triangle,
.partner-page-content svg.lucide-triangle-alert,
.partner-page-content svg.lucide-circle-alert {
  background: url('/assets/Custom-Icons/optimized-128/claim-overdue.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-layers-3,
.partner-page-content svg.lucide-layers,
.partner-page-content svg.lucide-package-check {
  background: url('/assets/Custom-Icons/optimized-128/policy-booked.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-target,
.partner-page-content svg.lucide-crosshair,
.partner-page-content svg.lucide-briefcase-business {
  background: url('/assets/Custom-Icons/optimized-128/tasks-work-queue.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-network,
.partner-page-content svg.lucide-workflow,
.partner-page-content svg.lucide-git-branch {
  background: url('/assets/Custom-Icons/optimized-128/distribution-network.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-activity,
.partner-page-content svg.lucide-list-checks,
.partner-page-content svg.lucide-badge-check,
.partner-page-content svg.lucide-circle-check-big {
  background: url('/assets/Custom-Icons/optimized-128/tasks-completed.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-clock-3,
.partner-page-content svg.lucide-clock,
.partner-page-content svg.lucide-timer,
.partner-page-content svg.lucide-hourglass {
  background: url('/assets/Custom-Icons/optimized-128/policy-intake-review.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-file-warning,
.partner-page-content svg.lucide-file-clock {
  background: url('/assets/Custom-Icons/optimized-128/documents-pending.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-book-open,
.partner-page-content svg.lucide-graduation-cap,
.partner-page-content svg.lucide-life-buoy,
.partner-page-content svg.lucide-headphones {
  background: url('/assets/Custom-Icons/optimized-128/documents.png') center / contain no-repeat;
}

.partner-page-content svg.lucide-lock-keyhole {
  background: url('/assets/Custom-Icons/optimized-128/accounts-finance.png') center / contain no-repeat;
}

/* Hide only the Lucide drawing. The SVG box remains in flow and carries the PNG. */
.partner-page-content svg:is(
  .lucide-bar-chart-3,
  .lucide-chart-no-axes-column-increasing,
  .lucide-trending-up,
  .lucide-circle-dollar-sign,
  .lucide-receipt-indian-rupee,
  .lucide-badge-indian-rupee,
  .lucide-wallet-cards,
  .lucide-indian-rupee,
  .lucide-repeat-2,
  .lucide-refresh-cw,
  .lucide-calendar-clock,
  .lucide-calendar-sync,
  .lucide-users-round,
  .lucide-users,
  .lucide-user-round-check,
  .lucide-user-round,
  .lucide-circle-user-round,
  .lucide-file-text,
  .lucide-shield-check,
  .lucide-files,
  .lucide-file-check-2,
  .lucide-file-input,
  .lucide-file-up,
  .lucide-upload,
  .lucide-clipboard-check,
  .lucide-clipboard-list,
  .lucide-shield-alert,
  .lucide-clipboard-plus,
  .lucide-alert-triangle,
  .lucide-triangle-alert,
  .lucide-circle-alert,
  .lucide-layers-3,
  .lucide-layers,
  .lucide-package-check,
  .lucide-target,
  .lucide-crosshair,
  .lucide-briefcase-business,
  .lucide-network,
  .lucide-workflow,
  .lucide-git-branch,
  .lucide-activity,
  .lucide-list-checks,
  .lucide-badge-check,
  .lucide-circle-check-big,
  .lucide-clock-3,
  .lucide-clock,
  .lucide-timer,
  .lucide-hourglass,
  .lucide-file-warning,
  .lucide-file-clock,
  .lucide-book-open,
  .lucide-graduation-cap,
  .lucide-life-buoy,
  .lucide-headphones,
  .lucide-lock-keyhole
) > * {
  opacity: 0;
}
`;

export function PartnerPageCustomIconStyles() {
  return <style dangerouslySetInnerHTML={{ __html: customIconCss }} />;
}
