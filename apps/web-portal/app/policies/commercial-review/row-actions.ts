"use server";

import { bulkSavePolicyCommercials, type CommercialSide } from "./actions";

export type SaveCommercialRowInput = {
  policyId: string;
  side: CommercialSide;
  odPercent: string;
  tpPercent: string;
  schemeAmount?: string;
  note?: string;
};

export async function savePolicyCommercialRow(input: SaveCommercialRowInput) {
  return bulkSavePolicyCommercials({
    policyIds: [input.policyId],
    side: input.side,
    odPercent: input.odPercent,
    tpPercent: input.tpPercent,
    schemeAmount: input.side === "insurer" ? input.schemeAmount : undefined,
    note: input.note,
  });
}
