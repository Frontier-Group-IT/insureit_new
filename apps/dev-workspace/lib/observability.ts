type Tone = "ok" | "warn" | "error" | "muted";

export type ProviderStatus = {
  name: string;
  detail: string;
  status: string;
  tone: Tone;
  source: "live" | "configured" | "degraded";
};

export type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  sha: string;
  url: string;
  createdAt: string;
};

export type ObservabilitySnapshot = {
  generatedAt: string;
  repository: {
    branch: string;
    sha: string | null;
    workflows: WorkflowRun[];
    openPullRequests: number | null;
  };
  applications: {
    portal: ProviderStatus;
    tech: ProviderStatus;
    developer: ProviderStatus;
  };
  providers: ProviderStatus[];
  credentials: {
    vercelManagement: boolean;
    supabaseManagement: boolean;
    githubAuthenticated: boolean;
  };
};

const GITHUB_REPO = "Frontier-Group-IT/insureit_new";
const SUPABASE_REF = "ilzhsfqqjyppzzvfscmh";
const VERCEL_TEAM_ID = "team_DsOUqnF8Pbd7YGNt8RCE8NgA";

const VERCEL_PROJECTS = {
  portal: "prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq",
  tech: "prj_WYgZdOJX6ARS4cfcncbwhqXVzqam",
  developer: "prj_LuDgeH31z9zpSDwqx2B94HmV0bWO"
} as const;

async function safeFetch(url: string, init: RequestInit = {}, timeout = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(name: string, url: string): Promise<ProviderStatus> {
  try {
    const response = await safeFetch(url, { method: "GET", redirect: "follow" });
    const healthy = response.status >= 200 && response.status < 500;
    return {
      name,
      detail: url.replace(/^https?:\/\//, ""),
      status: healthy ? `HTTP ${response.status}` : `HTTP ${response.status}`,
      tone: healthy ? "ok" : "error",
      source: "live"
    };
  } catch {
    return { name, detail: url.replace(/^https?:\/\//, ""), status: "Unreachable", tone: "error", source: "live" };
  }
}

async function githubSnapshot() {
  const token = process.env.GITHUB_READ_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "insureit-developer-workspace"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const [runsResponse, repoResponse, prsResponse] = await Promise.all([
    safeFetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/runs?branch=main&per_page=8`, { headers }),
    safeFetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, { headers }),
    safeFetch(`https://api.github.com/search/issues?q=repo:${GITHUB_REPO}+is:pr+is:open&per_page=1`, { headers })
  ]);

  if (!runsResponse.ok || !repoResponse.ok) throw new Error("GitHub read failed");

  const runsJson = await runsResponse.json() as { workflow_runs?: Array<Record<string, unknown>> };
  const commitJson = await repoResponse.json() as { sha?: string };
  const prsJson = prsResponse.ok ? await prsResponse.json() as { total_count?: number } : null;

  const workflows: WorkflowRun[] = (runsJson.workflow_runs ?? []).map((run) => ({
    id: Number(run.id ?? 0),
    name: String(run.name ?? "Workflow"),
    status: String(run.status ?? "unknown"),
    conclusion: run.conclusion ? String(run.conclusion) : null,
    branch: String(run.head_branch ?? ""),
    sha: String(run.head_sha ?? ""),
    url: String(run.html_url ?? ""),
    createdAt: String(run.created_at ?? "")
  }));

  return {
    sha: commitJson.sha ?? null,
    workflows,
    openPullRequests: typeof prsJson?.total_count === "number" ? prsJson.total_count : null,
    authenticated: Boolean(token)
  };
}

async function supabaseHealth(): Promise<ProviderStatus> {
  const managementToken = process.env.SUPABASE_READ_TOKEN;

  if (managementToken) {
    try {
      const response = await safeFetch(
        `https://api.supabase.com/v1/projects/${SUPABASE_REF}/health?services=auth,db,storage,rest,realtime`,
        { headers: { Authorization: `Bearer ${managementToken}` } }
      );
      if (response.ok) {
        return { name: "Supabase", detail: "Management API · project services", status: "Services healthy", tone: "ok", source: "configured" };
      }
      return { name: "Supabase", detail: "Management API credential configured", status: `API ${response.status}`, tone: "warn", source: "configured" };
    } catch {
      return { name: "Supabase", detail: "Management API credential configured", status: "API unreachable", tone: "error", source: "configured" };
    }
  }

  try {
    const response = await safeFetch(`https://${SUPABASE_REF}.supabase.co/auth/v1/health`);
    return {
      name: "Supabase",
      detail: "Supabase gateway response · management token not configured",
      status: response.ok ? "Reachable" : (response.status === 401 || response.status === 403 ? "Reachable · auth required" : `HTTP ${response.status}`),
      tone: response.ok ? "ok" : (response.status === 401 || response.status === 403 ? "warn" : "error"),
      source: "degraded"
    };
  } catch {
    return { name: "Supabase", detail: "Management token not configured", status: "Unreachable", tone: "error", source: "degraded" };
  }
}

async function vercelHealth(): Promise<ProviderStatus> {
  const token = process.env.VERCEL_READ_TOKEN;
  if (!token) {
    return {
      name: "Vercel",
      detail: "Live site checks enabled · management token not configured",
      status: "Reachability only",
      tone: "warn",
      source: "degraded"
    };
  }

  try {
    const checks = await Promise.all(Object.entries(VERCEL_PROJECTS).map(async ([name, projectId]) => {
      const response = await safeFetch(
        `https://api.vercel.com/v13/deployments?projectId=${projectId}&teamId=${VERCEL_TEAM_ID}&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return [name, response.ok] as const;
    }));
    const healthy = checks.every(([, ok]) => ok);
    return {
      name: "Vercel",
      detail: "Management API · Portal + Tech + Developer",
      status: healthy ? "Deployments readable" : "Partial API failure",
      tone: healthy ? "ok" : "warn",
      source: "configured"
    };
  } catch {
    return { name: "Vercel", detail: "Management API credential configured", status: "API unreachable", tone: "error", source: "configured" };
  }
}

export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const [portal, tech, developer, supabase, vercel] = await Promise.all([
    checkUrl("Operations Portal", "https://portal.insureit.in"),
    checkUrl("InsureIT Tech", "https://insureit.tech"),
    Promise.resolve({
      name: "Developer Workspace",
      detail: process.env.VERCEL_ENV ? `Vercel ${process.env.VERCEL_ENV}` : "Current runtime",
      status: "Running",
      tone: "ok",
      source: "live"
    } satisfies ProviderStatus),
    supabaseHealth(),
    vercelHealth()
  ]);

  let github: Awaited<ReturnType<typeof githubSnapshot>> | null = null;
  try {
    github = await githubSnapshot();
  } catch {
    github = null;
  }

  const latestWorkflow = github?.workflows[0];
  const githubStatus: ProviderStatus = github
    ? {
        name: "GitHub",
        detail: latestWorkflow ? `Latest: ${latestWorkflow.name}` : "Repository + Actions",
        status: latestWorkflow
          ? (latestWorkflow.status === "completed" ? (latestWorkflow.conclusion ?? "completed") : latestWorkflow.status)
          : "Connected",
        tone: latestWorkflow?.conclusion === "failure" ? "error" : latestWorkflow?.status === "in_progress" ? "warn" : "ok",
        source: github.authenticated ? "configured" : "live"
      }
    : { name: "GitHub", detail: "Repository + Actions", status: "Read failed", tone: "error", source: "live" };

  return {
    generatedAt: new Date().toISOString(),
    repository: {
      branch: "main",
      sha: github?.sha ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      workflows: github?.workflows ?? [],
      openPullRequests: github?.openPullRequests ?? null
    },
    applications: { portal, tech, developer },
    providers: [
      githubStatus,
      vercel,
      supabase,
      { name: "Expo", detail: "Release integration not connected yet", status: "Planned", tone: "muted", source: "degraded" },
      { name: "Document AI", detail: "Health adapter not connected yet", status: "Planned", tone: "muted", source: "degraded" },
      { name: "Voice AI", detail: "Health adapter not connected yet", status: "Planned", tone: "muted", source: "degraded" }
    ],
    credentials: {
      vercelManagement: Boolean(process.env.VERCEL_READ_TOKEN),
      supabaseManagement: Boolean(process.env.SUPABASE_READ_TOKEN),
      githubAuthenticated: Boolean(process.env.GITHUB_READ_TOKEN)
    }
  };
}
