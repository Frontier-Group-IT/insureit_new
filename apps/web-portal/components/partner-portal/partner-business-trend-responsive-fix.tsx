"use client";

import { useEffect } from "react";

const SOURCE_WIDTH = 600;
const SOURCE_HEIGHT = 190;
const SOURCE_PLOT_LEFT = 24;
const SOURCE_PLOT_RIGHT = 576;
const TARGET_HEIGHT = 210;

function remember(element: Element, attribute: string) {
  const key = `data-trend-original-${attribute}`;
  const existing = element.getAttribute(key);
  if (existing !== null) return existing;

  const value = element.getAttribute(attribute);
  if (value !== null) element.setAttribute(key, value);
  return value;
}

function numberAttribute(element: Element, attribute: string) {
  const value = remember(element, attribute);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PartnerBusinessTrendResponsiveFix() {
  useEffect(() => {
    let observedSvg: SVGSVGElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;

    const applyLayout = (svg: SVGSVGElement) => {
      const width = svg.clientWidth;
      if (!Number.isFinite(width) || width <= 0) return;

      const yScale = TARGET_HEIGHT / SOURCE_HEIGHT;
      const safeMargin = Math.max(20, Math.min(30, width * 0.022));
      const targetPlotWidth = Math.max(1, width - safeMargin * 2);
      const sourcePlotWidth = SOURCE_PLOT_RIGHT - SOURCE_PLOT_LEFT;
      const mapX = (sourceX: number) => safeMargin + ((sourceX - SOURCE_PLOT_LEFT) / sourcePlotWidth) * targetPlotWidth;

      svg.removeAttribute("viewBox");
      svg.removeAttribute("preserveAspectRatio");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", String(TARGET_HEIGHT));
      svg.style.width = "100%";
      svg.style.height = `${TARGET_HEIGHT}px`;

      svg.querySelectorAll("line").forEach((line) => {
        const originalY1 = numberAttribute(line, "y1");
        const originalY2 = numberAttribute(line, "y2");
        if (originalY1 !== null) line.setAttribute("y1", String(originalY1 * yScale));
        if (originalY2 !== null) line.setAttribute("y2", String(originalY2 * yScale));

        // BusinessTrend only renders horizontal grid lines as <line> elements.
        line.setAttribute("x1", "8");
        line.setAttribute("x2", String(Math.max(8, width - 8)));
      });

      svg.querySelectorAll("rect").forEach((rect) => {
        const originalX = numberAttribute(rect, "x");
        const originalY = numberAttribute(rect, "y");
        const originalWidth = numberAttribute(rect, "width");
        const originalHeight = numberAttribute(rect, "height");
        const originalRx = numberAttribute(rect, "rx");

        if (originalX !== null && originalWidth !== null) {
          const sourceCenter = originalX + originalWidth / 2;
          rect.setAttribute("x", String(mapX(sourceCenter) - originalWidth / 2));
          rect.setAttribute("width", String(originalWidth));
        }
        if (originalY !== null) rect.setAttribute("y", String(originalY * yScale));
        if (originalHeight !== null) rect.setAttribute("height", String(originalHeight * yScale));
        if (originalRx !== null) rect.setAttribute("rx", String(originalRx * yScale));
      });

      svg.querySelectorAll("circle").forEach((circle) => {
        const originalCx = numberAttribute(circle, "cx");
        const originalCy = numberAttribute(circle, "cy");
        const originalR = numberAttribute(circle, "r");

        if (originalCx !== null) circle.setAttribute("cx", String(mapX(originalCx)));
        if (originalCy !== null) circle.setAttribute("cy", String(originalCy * yScale));
        if (originalR !== null) circle.setAttribute("r", String(originalR * yScale));
      });

      svg.querySelectorAll("text").forEach((text) => {
        const originalX = numberAttribute(text, "x");
        const originalY = numberAttribute(text, "y");
        const originalFontSize = numberAttribute(text, "font-size");

        if (originalX !== null) text.setAttribute("x", String(mapX(originalX)));
        if (originalY !== null) text.setAttribute("y", String(originalY * yScale));
        if (originalFontSize !== null) text.setAttribute("font-size", String(originalFontSize * yScale));
      });

      svg.querySelectorAll("polyline").forEach((polyline) => {
        const originalPoints = remember(polyline, "points");
        if (!originalPoints) return;

        const remapped = originalPoints
          .trim()
          .split(/\s+/)
          .map((pair) => {
            const [rawX, rawY] = pair.split(",");
            const x = Number(rawX);
            const y = Number(rawY);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return pair;
            return `${mapX(x)},${y * yScale}`;
          })
          .join(" ");

        polyline.setAttribute("points", remapped);
        const originalStrokeWidth = numberAttribute(polyline, "stroke-width");
        if (originalStrokeWidth !== null) polyline.setAttribute("stroke-width", String(originalStrokeWidth * yScale));
      });
    };

    const connect = () => {
      const svg = document.querySelector<SVGSVGElement>('svg[aria-label^="Premium and policy trend for"]');
      if (!svg) return;

      if (svg !== observedSvg) {
        resizeObserver?.disconnect();
        observedSvg = svg;
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => applyLayout(svg));
        });
        resizeObserver.observe(svg);
      }

      applyLayout(svg);
    };

    connect();

    const mutationObserver = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(connect);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  return null;
}
