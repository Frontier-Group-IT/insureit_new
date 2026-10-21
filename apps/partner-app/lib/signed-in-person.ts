import type { PartnerIdentity } from './partner-session';

type ExtendedIdentity = PartnerIdentity & {
  associate_name?: string | null;
  associate_role?: string | null;
  associate_designation?: string | null;
  account_subtype?: string | null;
  group_name?: string | null;
  branch_name?: string | null;
  portal_access_type?: string | null;
};

/** Presentation only: never use this value to select business data or permissions. */
export function signedInPersonName(identity: PartnerIdentity): string {
  const person = identity as ExtendedIdentity;
  const associate = person.associate_name?.trim();
  return associate || identity.display_name?.trim() || 'Partner';
}

function readable(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function signedInPersonRole(identity: PartnerIdentity): string {
  const person = identity as ExtendedIdentity;
  if (person.associate_role?.trim()) return readable(person.associate_role.trim());
  if (identity.actor_kind === 'employee') return readable(identity.role);
  if (person.account_subtype === 'group_associate') return 'Group Associate';
  return readable(identity.intermediary_type);
}

export function signedInOrganizationName(identity: PartnerIdentity): string | null {
  if (identity.actor_kind === 'employee') return null;
  const person = identity as ExtendedIdentity;
  return person.group_name?.trim() || person.branch_name?.trim() || identity.partner_name?.trim() || null;
}
