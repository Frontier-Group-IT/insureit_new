import "server-only";

import { loadPolicyBusinessNetReport, type PolicyBusinessNetReport } from "@/lib/reports/policy-business";

type ViewerProfile = { id: string; role: string | null };
export type RmPerformanceQuery = { rm?: string; from?: string; to?: string };

export type RmPerformanceRow = {
  employeeId: string | null;
  name: string;
  todayPolicies: number;
  todayNetPremium: number;
  mtdPolicies: number;
  mtdNetPremium: number;
  averageNetPremium: number;
  contributionPercent: number;
};

export type RmPerformanceData = {
  generatedAt: string;
  selectedRmId: string | null;
  selectedRmName: string | null;
  filters: {
    rms: Array<{ id: string; name: string }>;
  };
  today: PolicyBusinessNetReport["summary"];
  mtd: PolicyBusinessNetReport["summary"];
  ytdTrend: PolicyBusinessNetReport["trend"];
  insurerMix: PolicyBusinessNetReport["insurers"];
  rows: RmPerformanceRow[];
  recentPolicies: PolicyBusinessNetReport["register"]["rows"];
  segment: {
    classified: boolean;
    note: string;
  };
};

export async function loadRmPerformance(profile: ViewerProfile, query: RmPerformanceQuery): Promise<RmPerformanceData> {
  const selectedRmId = validUuid(query.rm);
  const today = indiaDate(new Date());

  const [todayPayload, mtdPayload, ytdPayload] = await Promise.all([
    loadPolicyBusinessNetReport(profile, {
      period: "custom",
      from: today,
      to: today,
      rm: selectedRmId ?? undefined,
      page: "1",
    }),
    loadPolicyBusinessNetReport(profile, {
      period: "mtd",
      rm: selectedRmId ?? undefined,
      page: "1",
    }),
    loadPolicyBusinessNetReport(profile, {
      period: "ytd",
      rm: selectedRmId ?? undefined,
      page: "1",
    }),
  ]);

  const todayByRm = new Map(
    todayPayload.report.rms.map((row) => [
      row.employee_id ?? row.name,
      { policies: row.policy_count, premium: row.net_premium },
    ]),
  );
  const totalMtdPremium = mtdPayload.report.rms.reduce((sum, row) => sum + row.net_premium, 0);

  const rows = mtdPayload.report.rms
    .map((row) => {
      const todayRow = todayByRm.get(row.employee_id ?? row.name);
      return {
        employeeId: row.employee_id ?? null,
        name: row.name,
        todayPolicies: todayRow?.policies ?? 0,
        todayNetPremium: todayRow?.premium ?? 0,
        mtdPolicies: row.policy_count,
        mtdNetPremium: row.net_premium,
        averageNetPremium: row.average_net_premium,
        contributionPercent: totalMtdPremium > 0 ? (row.net_premium / totalMtdPremium) * 100 : 0,
      };
    })
    .sort((a, b) => b.mtdNetPremium - a.mtdNetPremium || b.mtdPolicies - a.mtdPolicies || a.name.localeCompare(b.name));

  const selectedRmName =
    selectedRmId
      ? mtdPayload.report.filters.rms.find((rm) => rm.id === selectedRmId)?.name
        ?? todayPayload.report.filters.rms.find((rm) => rm.id === selectedRmId)?.name
        ?? rows[0]?.name
        ?? null
      : null;

  return {
    generatedAt: new Date().toISOString(),
    selectedRmId,
    selectedRmName,
    filters: { rms: mtdPayload.report.filters.rms },
    today: todayPayload.report.summary,
    mtd: mtdPayload.report.summary,
    ytdTrend: ytdPayload.report.trend.slice(-6),
    insurerMix: mtdPayload.report.insurers.slice(0, 6),
    rows,
    recentPolicies: mtdPayload.report.register.rows.slice(0, 12),
    segment: {
      classified: false,
      note: "Retail / Fleet classification is not yet populated in policy master data. Figures are intentionally not inferred.",
    },
  };
}

function validUuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
