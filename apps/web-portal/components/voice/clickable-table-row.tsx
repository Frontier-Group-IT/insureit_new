"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useRouter } from "next/navigation";

export function ClickableTableRow({
  href,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function shouldIgnore(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("a,button,input,select,textarea,form,label"));
  }

  return (
    <tr
      {...props}
      tabIndex={0}
      role="link"
      className={`cursor-pointer outline-none transition hover:bg-[#F8FAFC] focus-visible:bg-[#EEF4FF] ${className}`}
      onClick={(event) => {
        if (!shouldIgnore(event.target)) router.push(href);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          if (!shouldIgnore(event.target)) {
            event.preventDefault();
            router.push(href);
          }
        }
      }}
    >
      {children}
    </tr>
  );
}
