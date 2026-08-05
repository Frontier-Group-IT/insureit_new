import fs from "node:fs";

const path = "apps/web-portal/components/policy-form-authbridge.tsx";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
  'const [position, setPosition] = useState<{ left:number; width:number } | null>(null);',
  'const [position, setPosition] = useState<{ left:number; width:number; top:number } | null>(null);',
);

text = text.replace(
  'setPosition({ left: rect.left, width: rect.width });',
  'const safeTop = 172;\n      setPosition({ left: rect.left, width: rect.width, top: Math.max(rect.top, safeTop) });',
);

text = text.replace(
  'window.addEventListener("resize", updatePosition);',
  'window.addEventListener("resize", updatePosition);\n    window.addEventListener("scroll", updatePosition, true);',
);

text = text.replace(
  'window.removeEventListener("resize", updatePosition);\n      observer.disconnect();',
  'window.removeEventListener("resize", updatePosition);\n      window.removeEventListener("scroll", updatePosition, true);\n      observer.disconnect();',
);

text = text.replace(
  '<div className="fixed top-24 z-30" style={{ left: position.left, width: position.width }}>{card}</div>',
  '<div className="fixed z-30" style={{ left: position.left, width: position.width, top: position.top }}>{card}</div>',
);

if (!text.includes('top: Math.max(rect.top, safeTop)')) throw new Error("Top clamp patch was not applied");
if (!text.includes('window.addEventListener("scroll", updatePosition, true)')) throw new Error("Nested scroll listener was not applied");
if (!text.includes('top: position.top')) throw new Error("Dynamic top style was not applied");

fs.writeFileSync(path, text);
