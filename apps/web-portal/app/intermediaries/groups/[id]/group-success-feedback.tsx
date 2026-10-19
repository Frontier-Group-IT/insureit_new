"use client";

import { useEffect, useState } from "react";

export function GroupSuccessFeedback({ success }: { success?: string }) {
  const [visible, setVisible] = useState(Boolean(success));

  useEffect(() => {
    setVisible(Boolean(success));
    if (!success) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      if (url.searchParams.get("success") === success) {
        url.searchParams.delete("success");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (!success || !visible) return null;

  const summary = success === "business_members_moved"
    ? "Partner added to Group successfully."
    : success === "updated" ? "Group details updated successfully." : "Group saved successfully.";

  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-xs text-green-700">{summary}</div>
  );
}
