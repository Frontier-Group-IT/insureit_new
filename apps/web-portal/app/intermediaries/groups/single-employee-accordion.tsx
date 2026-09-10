"use client";

import { type ReactNode, useEffect, useRef } from "react";

type AccordionArticle = HTMLElement & { firstElementChild: Element | null };

function getEmployeeArticles(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("article")).filter(
    (article): article is AccordionArticle => article.firstElementChild instanceof HTMLButtonElement,
  );
}

function isExpanded(article: AccordionArticle) {
  return article.children.length > 1;
}

export function SingleEmployeeAccordion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const preferredArticleRef = useRef<AccordionArticle | null>(null);
  const suppressCaptureRef = useRef(false);

  function closeOtherExpandedArticles(preferredArticle: AccordionArticle | null) {
    const root = rootRef.current;
    if (!root) return;

    const expandedArticles = getEmployeeArticles(root).filter(isExpanded);
    if (expandedArticles.length <= 1) return;

    const keep = preferredArticle && root.contains(preferredArticle) && isExpanded(preferredArticle)
      ? preferredArticle
      : expandedArticles[0];

    suppressCaptureRef.current = true;
    try {
      expandedArticles.forEach((article) => {
        if (article === keep) return;
        const header = article.firstElementChild;
        if (header instanceof HTMLButtonElement) header.click();
      });
    } finally {
      suppressCaptureRef.current = false;
    }
  }

  function hideIncompatibleExpandAllControl() {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button.textContent?.trim() === "Expand all") button.hidden = true;
    });
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    hideIncompatibleExpandAllControl();
    closeOtherExpandedArticles(preferredArticleRef.current);

    const observer = new MutationObserver(() => {
      hideIncompatibleExpandAllControl();
      queueMicrotask(() => closeOtherExpandedArticles(preferredArticleRef.current));
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (suppressCaptureRef.current) return;

    const root = rootRef.current;
    const target = event.target;
    if (!root || !(target instanceof Element)) return;

    const clickedButton = target.closest("button");
    if (!(clickedButton instanceof HTMLButtonElement) || !root.contains(clickedButton)) return;

    if (clickedButton.textContent?.trim() === "Expand all") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const header = target.closest("article > button");
    if (!(header instanceof HTMLButtonElement)) return;

    const article = header.parentElement;
    if (!(article instanceof HTMLElement) || article.tagName !== "ARTICLE") return;

    preferredArticleRef.current = article as AccordionArticle;

    const otherExpandedArticles = getEmployeeArticles(root).filter(
      (candidate) => candidate !== article && isExpanded(candidate),
    );
    if (!otherExpandedArticles.length) return;

    suppressCaptureRef.current = true;
    try {
      otherExpandedArticles.forEach((candidate) => {
        const candidateHeader = candidate.firstElementChild;
        if (candidateHeader instanceof HTMLButtonElement) candidateHeader.click();
      });
    } finally {
      suppressCaptureRef.current = false;
    }
  }

  return (
    <div ref={rootRef} onClickCapture={handleClickCapture}>
      {children}
    </div>
  );
}
