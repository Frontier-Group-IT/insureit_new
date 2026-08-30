type RouteTimingPhases = Record<string, number>;

export function logPortalRoutePerformance(route: string, phases: RouteTimingPhases) {
  if (process.env.NODE_ENV !== "production") return;
  const rounded = Object.fromEntries(
    Object.entries(phases).map(([key, value]) => [key, Math.max(0, Math.round(value))]),
  );
  console.info("portal_route_perf", { route, ...rounded });
}
