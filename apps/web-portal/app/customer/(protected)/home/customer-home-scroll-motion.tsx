"use client";

import { useEffect } from "react";

/** Presentation-only: observe the existing server-rendered Home sections without changing their data or links. */
export function CustomerHomeScrollMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-customer-home]");
    if (!root || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-home-reveal]"));
    if (!targets.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).classList.add("customer-home-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
    targets.forEach(target => observer.observe(target));
    root.classList.add("customer-home-motion-ready");
    return () => { observer.disconnect(); root.classList.remove("customer-home-motion-ready"); };
  }, []);
  return null;
}
