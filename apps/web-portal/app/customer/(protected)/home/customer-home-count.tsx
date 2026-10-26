"use client";

import { useEffect, useRef, useState } from "react";

/** Animate a verified server-provided count once, without altering the underlying value. */
export function CustomerHomeCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const spanRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = spanRef.current;
    if (!target || typeof IntersectionObserver === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let observed = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || observed) return;
      observed = true;
      observer.disconnect();
      const start = performance.now();
      const duration = 540;
      const animate = (time: number) => {
        const t = Math.min(1, (time - start) / duration);
        setDisplay(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, { threshold: 0.15 });
    observer.observe(target);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={spanRef} className="tabular-nums">{display.toLocaleString("en-IN")}</span>;
}
