"use server";

import {
  permanentDeleteEntity as permanentDeleteEntityCore,
  type PermanentDeleteKind,
  type PermanentDeleteResult,
} from "@/lib/admin-permanent-delete";

export type { PermanentDeleteKind, PermanentDeleteResult };

export async function permanentDeleteEntity(
  kind: PermanentDeleteKind,
  id: string,
  relatedId?: string,
): Promise<PermanentDeleteResult> {
  return permanentDeleteEntityCore(kind, id, relatedId);
}
