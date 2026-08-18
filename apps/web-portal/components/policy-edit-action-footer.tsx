"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function findOriginalSaveButton() {
  const root = document.querySelector<HTMLElement>("[data-policy-edit-form]");
  if (!root) return null;
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const label = button.textContent?.trim() ?? "";
    return label === "Save Policy Changes" || label === "Saving changes…";
  }) ?? null;
}

export function PolicyEditActionFooter() {
  const [label, setLabel] = useState("Save Policy Changes");
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const original = findOriginalSaveButton();
    if (!original) return;

    const sync = () => {
      setLabel(original.textContent?.trim() || "Save Policy Changes");
      setDisabled(original.disabled);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(original, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function savePolicy() {
    const original = findOriginalSaveButton();
    if (!original || original.disabled) return;
    original.click();
  }

  return (
    <>
      <style>{`
        [data-policy-edit-form] > div { padding-bottom: 0 !important; }
        [data-policy-edit-form] .fixed.bottom-0.left-0.right-0.z-40 { display: none !important; }
      `}</style>
      <div className="mt-3 border-t border-[#D9E2F0] bg-white px-4 py-3 shadow-[0_-4px_18px_rgba(15,23,42,.04)]">
        <div data-policy-edit-action-footer className="mx-auto flex max-w-[1480px] items-center justify-end gap-2">
          <Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">
            Cancel
          </Link>
          <button
            type="button"
            onClick={savePolicy}
            disabled={disabled}
            className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#214A7A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {label}
          </button>
        </div>
      </div>
    </>
  );
}
