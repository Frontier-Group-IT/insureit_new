"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function AccountReviewBackLink({ href }: { href: string }) {
  return (
    <Link href={href} prefetch={false} className="text-[10px] font-semibold text-[#4F46E5] hover:underline">
      Back to account review
    </Link>
  );
}

export function FreshAccountReviewLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  );
}
