export type PartnerNotificationDestination =
  | { kind: 'activity' }
  | { kind: 'renewals' }
  | { kind: 'policy'; id: string }
  | { kind: 'claim'; id: string }
  | { kind: 'customer'; id: string }
  | { kind: 'policy_intake'; id: string };

export function partnerDestinationRoute(destination: PartnerNotificationDestination) {
  switch (destination.kind) {
    case 'activity': return '/activity';
    case 'renewals': return '/renewals';
    case 'policy': return `/policy/${safeId(destination.id)}`;
    case 'claim': return `/claim/${safeId(destination.id)}`;
    case 'customer': return `/customer/${safeId(destination.id)}`;
    case 'policy_intake': return `/policy-intakes/${safeId(destination.id)}`;
  }
}

export function isAllowedPartnerDestinationRoute(route: string) {
  const clean = route.split('?')[0]?.split('#')[0] || '';
  if (clean === '/activity' || clean === '/renewals') return true;
  return /^\/(policy|claim|customer|policy-intakes)\/[^/]+$/.test(clean)
    && !clean.includes('..')
    && !clean.includes('://');
}

function safeId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Partner destination id is required.');
  return encodeURIComponent(trimmed);
}
