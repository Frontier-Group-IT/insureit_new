/**
 * Design tokens for the redesigned intermediate register.
 *
 * Extends the existing Tailwind config with a unified, semantic color palette
 * and typography scale. These are consumed by every other component in this
 * folder so that styles never drift.
 *
 * To wire this into your Tailwind config, add these to the `theme.extend` section:
 *
 *   colors: {
 *     ...designTokens.colors,
 *   },
 *   fontFamily: { display: ["var(--font-display)"] },
 *
 * The tokens are also exported as a CSS file (`design-system.css`) so that
 * `globals.css` can `@import` them if you prefer CSS variables.
 */

export const designTokens = {
  colors: {
    // Neutral grays — replaces the inconsistent #64748B / #94A3B8 / #475569 mess
    neutral: {
      50: "#F8FAFC",
      100: "#F1F5F9",
      200: "#E2E8F0",
      300: "#CBD5E1",
      400: "#94A3B8",
      500: "#64748B",
      600: "#475569",
      700: "#334159",
      800: "#1E293B",
      900: "#0F172A",
    },
    // Brand (kept aligned with existing palette)
    brand: {
      navy: {
        50: "#EEF2FF",
        100: "#E0E7FF",
        500: "#6366F1",
        600: "#4F46E5",
        700: "#4338CA",
        800: "#3730A3",
        900: "#312E81",
      },
      accent: {
        50: "#F0F0FF",
        400: "#A78FFA",
        500: "#8B5CF6",
        600: "#7C3AED",
      },
      cyan: {
        400: "#2ED3D4",
        500: "#17C7C9",
      },
    },
    // Status colors — semantic, not just decorative
    status: {
      // Success / completed
      success: {
        bg: "#DCFCE7", // bg-green-100
        text: "#166534", // text-green-800
        border: "#86EFAC", // border-green-300
      },
      // Warning / in-progress
      warning: {
        bg: "#FEF3C7", // bg-amber-100
        text: "#92400E", // text-amber-700
        border: "#FBBF24", // border-amber-300
      },
      // Error / issues
      error: {
        bg: "#FEE2E2", // bg-red-100
        text: "#991B1B", // text-red-800
        border: "#FCA5A5", // border-red-300
      },
      // Info / neutral
      info: {
        bg: "#EFF6FF", // bg-blue-50
        text: "#1E40AF", // text-blue-800
        border: "#93C5FD", // border-blue-300
      },
      // Pending / muted
      pending: {
        bg: "#F1F5F9", // bg-slate-100
        text: "#475569", // text-slate-600
        border: "#CBD5E1", // border-slate-300
      },
    },
  },
  typography: {
    // Minimum 12px for table body
    tableHeader: "10px",
    tableBody: "12px",
    tableBodySmall: "11px",
    label: "10px",
    body: "13px",
    bodySmall: "11px",
    value: "14px",
    heading: "text-xl font-semibold", // 20px
    subheading: "text-sm font-semibold", // 14px
  },
  spacing: {
    tableCellPadding: "px-4 py-3",
    tableCellPaddingCompact: "px-3 py-2.5",
    borderRadius: {
      sm: "rounded-lg", // 8px — for inputs and badges
      md: "rounded-xl", // 12px — for cards and section borders
      lg: "rounded-2xl", // 16px — for large cards
    },
  },
};

/**
 * CSS variables generated from designTokens. Import design-system.css in
 * globals.css to make these available as native CSS variables alongside
 * the existing --* custom properties.
 */
export const cssVariables = `
  :root {
    /* Grays */
    --color-neutral-50: #F8FAFC;
    --color-neutral-100: #F1F5F9;
    --color-neutral-200: #E2E8F0;
    --color-neutral-300: #CBD5E1;
    --color-neutral-400: #94A3B8;
    --color-neutral-500: #64748B;
    --color-neutral-600: #475569;
    --color-neutral-700: #334159;
    --color-neutral-800: #1E293B;
    --color-neutral-900: #0F172A;

    /* Status */
    --status-success-bg: #DCFCE7;
    --status-success-text: #166534;
    --status-success-border: #86EFAC;
    --status-warning-bg: #FEF3C7;
    --status-warning-text: #92400E;
    --status-warning-border: #FBBF24;
    --status-error-bg: #FEE2E2;
    --status-error-text: #991B1B;
    --status-error-border: #FCA5A5;
    --status-info-bg: #EFF6FF;
    --status-info-text: #1E40AF;
    --status-info-border: #93C5FD;
    --status-pending-bg: #F1F5F9;
    --status-pending-text: #475569;
    --status-pending-border: #CBD5E1;
  }
`;
