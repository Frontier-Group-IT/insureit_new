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

/* Active scheme: keep it visually prominent and let secondary details collapse first. */
.partner-page-content [data-partner-active-scheme="true"] {
  min-width: 300px;
  max-width: min(560px, 46vw);
  min-height: 40px;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #B9CCF4;
  border-radius: 12px;
  background: linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 52%, #EEF9F5 100%);
  box-shadow: 0 5px 16px rgba(35, 78, 150, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  color: #34506F;
}

.partner-page-content [data-partner-active-scheme="true"]::before {
  content: "ACTIVE SCHEME";
  display: inline-flex;
  align-items: center;
  height: 21px;
  flex: 0 0 auto;
  padding: 0 7px;
  border-radius: 999px;
  background: #234E9B;
  color: #FFFFFF;
  font-size: 7.5px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.partner-page-content [data-partner-active-scheme="true"] > svg:first-of-type {
  width: 18px;
  height: 18px;
  color: #2763CD;
}

.partner-page-content [data-partner-active-scheme="true"] > span:first-of-type {
  min-width: 0;
  max-width: 240px;
  color: #173866;
  font-size: 11px;
  font-weight: 900;
}

.partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(n+2) {
  font-size: 9px;
  font-weight: 650;
}

.partner-page-content [data-partner-active-scheme="true"] > svg:last-of-type {
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: #2763CD;
}

.partner-page-content [data-partner-active-scheme="true"]:hover {
  border-color: #8EACE9;
  background: linear-gradient(135deg, #E6EFFF 0%, #F4F8FF 50%, #E9F7F2 100%);
  box-shadow: 0 7px 20px rgba(35, 78, 150, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
}

@media (max-width: 1180px) {
  .partner-page-content [data-partner-active-scheme="true"] {
    min-width: 250px;
    max-width: 360px;
  }

  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(4),
  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(5) {
    display: none;
  }
}

@media (max-width: 860px) {
  .partner-page-content [data-partner-active-scheme="true"] {
    min-width: 210px;
    max-width: 270px;
    padding-inline: 9px;
  }

  .partner-page-content [data-partner-active-scheme="true"]::before {
    display: none;
  }

  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(2),
  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(3),
  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(4),
  .partner-page-content [data-partner-active-scheme="true"] > span:nth-of-type(5) {
    display: none;
  }

  .partner-page-content [data-partner-active-scheme="true"] > span:first-of-type {
    max-width: 180px;
  }
}
`;

export function PartnerPageCustomIconStyles() {
  return <style dangerouslySetInnerHTML={{ __html: customIconCss }} />;
}
