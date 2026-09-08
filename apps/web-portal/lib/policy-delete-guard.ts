export type LinkedPolicyIntake = {
  id: string;
  status: string | null;
};

export type PolicyIntakeDeleteClassification = {
  rejectedIds: string[];
  blockingCount: number;
};

export function classifyPolicyIntakeDeleteLinks(
  links: LinkedPolicyIntake[]
): PolicyIntakeDeleteClassification {
  const rejectedIds: string[] = [];
  let blockingCount = 0;

  for (const link of links) {
    const status = link.status?.trim().toLowerCase() ?? "";
    if (status === "rejected") {
      rejectedIds.push(link.id);
    } else {
      blockingCount += 1;
    }
  }

  return { rejectedIds, blockingCount };
}
