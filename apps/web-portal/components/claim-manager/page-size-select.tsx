"use client";

import { useRouter, useSearchParams } from "next/navigation";

const pageSizeOptions = [5, 10, 20, 50, 100];

export function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={String(value)}
      aria-label="Items per page"
      className="h-7 rounded-md border border-[#DCE4EF] bg-white px-2 text-[11px] font-medium text-[#071D49] outline-none focus:border-[#174EA6]"
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pageSize", event.target.value);
        params.set("page", "1");
        router.push(`/claims?${params.toString()}`);
      }}
    >
      {pageSizeOptions.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}
