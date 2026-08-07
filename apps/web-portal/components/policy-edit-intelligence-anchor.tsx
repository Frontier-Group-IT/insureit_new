"use client";

// The Edit Policy screen has its own live financial summary. Do not inject a
// synthetic "Policy Onboarding" heading here: the shared onboarding intelligence
// discovers its form by that heading and mutates layout/DOM intended for the New
// Policy screen, which can destabilize the edit screen after hydration.
export function PolicyEditIntelligenceAnchor() {
  return null;
}
