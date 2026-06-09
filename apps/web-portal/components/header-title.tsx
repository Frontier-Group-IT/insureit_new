"use client";

import { usePathname } from "next/navigation";
import { navItems } from "./data";

function titleFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "dashboard";

  if (section === "dashboard") return "InsureIt Admin Portal";
  if (section === "customers" && segments[1] === "new") return "Add customer";
  if (section === "customers" && segments[2] === "edit") return "Edit customer";
  if (section === "vehicles" && segments[1] === "new") return "Add vehicle";
  if (section === "vehicles" && segments[2] === "edit") return "Edit vehicle";
  if (section === "policies" && segments[1] === "new") return "Add policy";
  if (section === "policies" && segments[2] === "edit") return "Edit policy";
  if (section === "claims" && segments[1]) return "Claim details";

  const navMatch = navItems.find(([, href]) => href === `/${section}`);
  return navMatch?.[0] ?? "InsureIt Admin Portal";
}

export function HeaderTitle({ title }: { title?: string }) {
  const pathname = usePathname();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">InsureIt</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">{title ?? titleFromPath(pathname)}</h1>
    </div>
  );
}
