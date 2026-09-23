"use client";

import { useEffect } from "react";

const MENU_TRIGGER_SELECTOR =
  '[aria-haspopup="menu"][aria-expanded="true"], [aria-haspopup="listbox"][aria-expanded="true"]';
const MENU_SURFACE_SELECTOR = '[role="menu"], [role="listbox"]';

function closestElement(target: EventTarget | null) {
  return target instanceof Element ? target : null;
}

function closeOpenDetails(target: Element | null) {
  document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
    if (target && details.contains(target)) return;
    details.removeAttribute("open");
  });
}

function closeAriaMenus(target: Element | null) {
  document.querySelectorAll<HTMLElement>(MENU_TRIGGER_SELECTOR).forEach((trigger) => {
    if (target && trigger.contains(target)) return;

    const controlsId = trigger.getAttribute("aria-controls");
    if (controlsId) {
      const controlled = document.getElementById(controlsId);
      if (controlled && target && controlled.contains(target)) return;
    }

    const localRoot = trigger.parentElement;
    if (localRoot && target && localRoot.contains(target)) {
      const surface = target.closest(MENU_SURFACE_SELECTOR);
      if (surface) return;
    }

    trigger.click();
  });
}

export function GlobalDropdownDismiss() {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = closestElement(event.target);
      closeOpenDetails(target);
      closeAriaMenus(target);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return null;
}
