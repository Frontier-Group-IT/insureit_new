import fs from 'node:fs';

const target = process.argv[2];
if (!target) throw new Error('Usage: node patch-0-1-partner-screen-hide-topbar.mjs <partner-screen.tsx>');

let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} source was not found`);
  source = source.replace(before, after);
};

replaceOnce(
  `  action,
  children,`,
  `  action,
  hideTopBar,
  children,`,
  'PartnerScreen argument list',
);

replaceOnce(
  `  action?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;`,
  `  action?: ReactNode;
  hideTopBar?: boolean;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;`,
  'PartnerScreen props',
);

replaceOnce(
  `        <PartnerTopBar
          title={title}
          eyebrow={eyebrow}
          subtitle={subtitle}
          onBack={onBack}
          backDisabled={backDisabled}
          artwork={artwork}
          action={action}
        />`,
  `        {hideTopBar ? null : (
          <PartnerTopBar
            title={title}
            eyebrow={eyebrow}
            subtitle={subtitle}
            onBack={onBack}
            backDisabled={backDisabled}
            artwork={artwork}
            action={action}
          />
        )}`,
  'PartnerTopBar render',
);

fs.writeFileSync(target, source);
