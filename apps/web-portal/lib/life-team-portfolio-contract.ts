export type PortfolioOwners = { employeeIds: string[]; directEmployeeId: string | null };
export type PortfolioLine = "Motor" | "Non Motor" | "Life" | "Health" | null;
type EmployeeLink = { id: string; reporting_manager_id: string | null };

export function lifeTeamOwnerIds(root:string, employees:EmployeeLink[], directId:string):string[] {
  if (!employees.some(employee => employee.id === root)) return [];
  const children = new Map<string,string[]>();
  for (const employee of employees) {
    if (!employee.reporting_manager_id) continue;
    const list = children.get(employee.reporting_manager_id) ?? [];
    list.push(employee.id);
    children.set(employee.reporting_manager_id,list);
  }
  const visited = new Set<string>();
  const queue = [root];
  while (queue.length) {
    const id = queue.pop()!;
    if (visited.has(id) || id === directId) continue;
    visited.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return [...visited].sort();
}

export function lifeTeamReadFilter(scope:PortfolioOwners):string {
  const filters:string[]=[];
  const team=scope.employeeIds.filter(id=>id!==scope.directEmployeeId);
  if(team.length)filters.push(`rm_employee_id.in.(${team.join(",")})`);
  if(scope.directEmployeeId)filters.push(`and(business_line.in.(Life,Health),rm_employee_id.eq.${scope.directEmployeeId})`);
  return filters.join(",") || "id.eq.00000000-0000-0000-0000-000000000000";
}

export function lifeTeamReportSegments(scope:PortfolioOwners,line:PortfolioLine):Array<{ids:string[];line:PortfolioLine}> {
  const segments:Array<{ids:string[];line:PortfolioLine}>=[];
  const team=scope.employeeIds.filter(id=>id!==scope.directEmployeeId);
  if(team.length)segments.push({ids:team,line});
  if(scope.directEmployeeId)for(const directLine of ["Life","Health"] as const){
    if(!line||line===directLine)segments.push({ids:[scope.directEmployeeId],line:directLine});
  }
  return segments;
}
