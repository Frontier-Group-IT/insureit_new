export function PolicyRemarksActionStyle() {
  return (
    <style>{`
      #policy-section-4 button[aria-expanded],
      #policy-section-5 button[aria-expanded] {
        min-height: 32px;
        border: 1px solid #D6E2F0;
        border-radius: 10px;
        background: #FFFFFF;
        padding: 0 12px;
        color: #17365D;
        font-weight: 700;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        cursor: pointer;
        transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
      }

      #policy-section-4 button[aria-expanded]:hover,
      #policy-section-5 button[aria-expanded]:hover {
        border-color: #9EBCE2;
        background: #EEF5FF;
        color: #123B75;
        box-shadow: 0 4px 10px rgba(49, 91, 154, 0.10);
        transform: translateY(-1px);
      }

      #policy-section-4 button[aria-expanded]:focus-visible,
      #policy-section-5 button[aria-expanded]:focus-visible {
        outline: none;
        border-color: #315B9A;
        box-shadow: 0 0 0 3px #DCE8FA;
      }

      #policy-section-4 button[aria-expanded] > span:first-child,
      #policy-section-5 button[aria-expanded] > span:first-child {
        display: inline-grid;
        height: 18px;
        width: 18px;
        place-items: center;
        border-radius: 999px;
        background: #EEF5FF;
        color: #315B9A;
        transition: background-color 160ms ease, color 160ms ease;
      }

      #policy-section-4 button[aria-expanded]:hover > span:first-child,
      #policy-section-4 button[aria-expanded="true"] > span:first-child,
      #policy-section-5 button[aria-expanded]:hover > span:first-child,
      #policy-section-5 button[aria-expanded="true"] > span:first-child {
        background: #DBEAFE;
        color: #17365D;
      }

      #policy-section-4 button[aria-expanded="true"],
      #policy-section-5 button[aria-expanded="true"] {
        border-color: #B7CAE3;
        background: #F8FBFF;
      }
    `}</style>
  );
}
