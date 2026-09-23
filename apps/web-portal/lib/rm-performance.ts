import "server-only";

import {
  loadPolicyBusinessNetReport,
  type PolicyBusinessNetReport,
  type PolicyBusinessRow,
} from "@/lib/reports/policy-business";

type ViewerProfile = { id: string; role: string | null };
export type RmPerformanceQuery = { rm?: string; from?: string; to?: string };

export type RmSourcePerformance = {
  key: string;
  label: string;
  type: string | null;
  todayPolicies: number;
  todayNetPremium: number;
  mtdPolicies: number;
  mtdNetPremium: number;
};

export type RmPerformanceRow = {
  employeeId: string | null;
  name: string;
  todayPolicies: number;
  todayNetPremium: number;
  mtdPolicies: number;
  mtdNetPremium: number;
  averageNetPremium: number;
  contributionPercent: number;
  sources: RmSourcePerformance[];
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
  rows: RmPerformanceRow[];
  recentPolicies: PolicyBusinessNetReport["register"]["rows"];
  sourceCoverageComplete: boolean;
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
      pageSize: "5000",
    }),
    loadPolicyBusinessNetReport(profile, {
      period: "mtd",
      rm: selectedRmId ?? undefined,
      page: "1",
      pageSize: "5000",
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

  const intermediaryNames = new Map(
    mtdPayload.report.filters.intermediaries.map((item) => [
      item.code,
      { name: item.name || item.code, type: item.type },
    ]),
  );

  const todaySources = aggregateSources(todayPayload.report.register.rows, intermediaryNames);
  const mtdSources = aggregateSources(mtdPayload.report.register.rows, intermediaryNames);

  const rows = mtdPayload.report.rms
    .map((row) => {
      const todayRow = todayByRm.get(row.employee_id ?? row.name);
      const rmName = row.name || "Unassigned";
      return {
        employeeId: row.employee_id ?? null,
        name: rmName,
        todayPolicies: todayRow?.policies ?? 0,
        todayNetPremium: todayRow?.premium ?? 0,
        mtdPolicies: row.policy_count,
        mtdNetPremium: row.net_premium,
        averageNetPremium: row.average_net_premium,
        contributionPercent: totalMtdPremium > 0 ? (row.net_premium / totalMtdPremium) * 100 : 0,
        sources: mergeSources(todaySources.get(rmName) ?? [], mtdSources.get(rmName) ?? []),
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
    rows,
    recentPolicies: mtdPayload.report.register.rows.slice(0, 10),
    sourceCoverageComplete:
      todayPayload.report.register.total_count <= todayPayload.report.register.rows.length
      && mtdPayload.report.register.total_count <= mtdPayload.report.register.rows.length,
  };
}

type SourceAggregate = {
  key: string;
  label: string;
  type: string | null;
  policies: number;
  netPremium: number;
};

function aggregateSources(
  rows: PolicyBusinessRow[],
  intermediaryNames: Map<string, { name: string; type: string | null }>,
) {
  const byRm = new Map<string, Map<string, SourceAggregate>>();

  for (const row of rows) {
    const rmName = row.rm_name?.trim() || "Unassigned";
    const code = row.intermediary_code?.trim() || "";
    const type = row.intermediary_type?.trim() || null;
    const key = code || type || "direct-unassigned";
    const known = code ? intermediaryNames.get(code) : null;
    const label = known?.name || code || type || "Direct / Unassigned";

    const rmSources = byRm.get(rmName) ?? new Map<string, SourceAggregate>();
    const source = rmSources.get(key) ?? {
      key,
      label,
      type: known?.type ?? type,
      policies: 0,
      netPremium: 0,
    };
    source.policies += 1;
    source.netPremium += row.net_premium;
    rmSources.set(key, source);
    byRm.set(rmName, rmSources);
  }

  return new Map(
    [...byRm.entries()].map(([rmName, sources]) => [
      rmName,
      [...sources.values()].sort((a, b) => b.netPremium - a.netPremium || b.policies - a.policies || a.label.localeCompare(b.label)),
    ]),
  );
}

function mergeSources(today: SourceAggregate[], mtd: SourceAggregate[]): RmSourcePerformance[] {
  const todayMap = new Map(today.map((item) => [item.key, item]));
  return mtd.map((item) => {
    const current = todayMap.get(item.key);
    return {
      key: item.key,
      label: item.label,
      type: item.type,
      todayPolicies: current?.policies ?? 0,
      todayNetPremium: current?.netPremium ?? 0,
      mtdPolicies: item.policies,
      mtdNetPremium: item.netPremium,
    };
  });
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
