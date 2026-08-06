from pathlib import Path

path = Path('apps/web-portal/components/policy-onboarding-intelligence.tsx')
text = path.read_text(encoding='utf-8')
old = '''        const rect = aside.getBoundingClientRect();
        const top = 112;
        const actionBar = Array.from(document.querySelectorAll("div.fixed.bottom-0"))[0] as HTMLElement | undefined;
        const actionBarTop = actionBar?.getBoundingClientRect().top ?? window.innerHeight - 58;
        const availableHeight = Math.max(440, actionBarTop - top - 16);
        const height = Math.min(520, availableHeight);
        setPosition({ left: rect.left, width: rect.width, top, height });'''
new = '''        const rect = aside.getBoundingClientRect();
        const onboardingHeader = heading?.closest(".mb-4") as HTMLElement | null;
        const onboardingHeaderBottom = onboardingHeader?.getBoundingClientRect().bottom ?? 96;
        const top = Math.max(104, onboardingHeaderBottom + 12);
        const actionBar = Array.from(document.querySelectorAll("div.fixed.bottom-0"))[0] as HTMLElement | undefined;
        const actionBarTop = actionBar?.getBoundingClientRect().top ?? window.innerHeight - 58;
        const availableHeight = Math.max(420, actionBarTop - top - 16);
        const height = Math.min(500, availableHeight);
        setPosition({ left: rect.left, width: rect.width, top, height });'''
if old not in text:
    raise SystemExit('Target positioning block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
