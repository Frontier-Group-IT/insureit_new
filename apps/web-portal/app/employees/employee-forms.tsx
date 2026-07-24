"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createEmployee, updateEmployee, type EmployeeActionState } from "./actions";

export type EmployeeRow = {
  id: string;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  department: string;
  designation: string;
  vertical: string | null;
  location: string | null;
  reporting_manager_id: string | null;
  reporting_manager_employee_code: string | null;
  employment_status: "active" | "inactive";
  profile_id: string | null;
};

type ManagerOption = Pick<EmployeeRow, "id" | "employee_code" | "full_name">;
type PortalRoleOption = { value: string; label: string };

const inputClass = "h-10 w-full rounded-md border border-[#CBD8E8] bg-white px-3 text-[12px] text-[#101828] outline-none transition focus:border-[#0B63CE] focus:ring-2 focus:ring-[#0B63CE]/10";
const labelClass = "grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#52657B]";
const initialEmployeeActionState: EmployeeActionState = { status: "idle", message: "" };

export function EmployeeCreateForm({ managers, portalRoles }: { managers: ManagerOption[]; portalRoles: PortalRoleOption[] }) {
  const [state, action] = useActionState(createEmployee, initialEmployeeActionState);
  const [createAccess, setCreateAccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setCreateAccess(false);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <EmployeeFields managers={managers} />
      <div className="rounded-lg border border-[#CFE2FF] bg-[#F5F9FF] p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input name="create_portal_access" type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B63CE]" checked={createAccess} onChange={(event) => setCreateAccess(event.target.checked)} />
          <span>
            <span className="block text-[12px] font-semibold text-[#071D49]">Create portal access</span>
            <span className="mt-0.5 block text-[10px] text-[#667085]">Send a secure email invitation. Employees without portal access remain in the directory.</span>
          </span>
        </label>
        {createAccess ? (
          <label className={`${labelClass} mt-3 max-w-sm`}>
            Portal role
            <select name="portal_role" className={inputClass} required>
              {portalRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <ActionMessage state={state} />
      <FormSubmitButton label="Onboard employee" pendingLabel="Onboarding" className="inline-flex h-10 items-center justify-center rounded-md bg-[#071D49] px-5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#123568] disabled:opacity-70" />
    </form>
  );
}

export function EmployeeEditForm({ employee, managers }: { employee: EmployeeRow; managers: ManagerOption[] }) {
  const action = updateEmployee.bind(null, employee.id);
  const [state, formAction] = useActionState(action, initialEmployeeActionState);
  return (
    <form action={formAction} className="space-y-4">
      <EmployeeFields employee={employee} managers={managers} />
      <ActionMessage state={state} />
      <FormSubmitButton label="Save changes" pendingLabel="Saving" className="inline-flex h-9 items-center justify-center rounded-md bg-[#071D49] px-4 text-[11px] font-semibold text-white disabled:opacity-70" />
    </form>
  );
}

function EmployeeFields({ employee, managers }: { employee?: EmployeeRow; managers: ManagerOption[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className={labelClass}>Employee code<input name="employee_code" defaultValue={employee?.employee_code ?? ""} className={inputClass} placeholder="SIBL/0015" required /></label>
      <label className={`${labelClass} sm:col-span-2`}>Full name<input name="full_name" defaultValue={employee?.full_name ?? ""} className={inputClass} required /></label>
      <label className={labelClass}>Mobile<input name="phone" defaultValue={employee?.phone ?? ""} className={inputClass} inputMode="tel" placeholder="+91" /></label>
      <label className={`${labelClass} sm:col-span-2`}>Work email<input name="email" defaultValue={employee?.email ?? ""} className={inputClass} type="email" /></label>
      <label className={labelClass}>Department<input name="department" defaultValue={employee?.department ?? ""} className={inputClass} required /></label>
      <label className={labelClass}>Designation<input name="designation" defaultValue={employee?.designation ?? ""} className={inputClass} required /></label>
      <label className={labelClass}>Vertical<input name="vertical" defaultValue={employee?.vertical ?? ""} className={inputClass} placeholder="All" /></label>
      <label className={labelClass}>Location<input name="location" defaultValue={employee?.location ?? ""} className={inputClass} placeholder="Pan India" /></label>
      <label className={`${labelClass} sm:col-span-2`}>
        Reporting manager
        <select name="reporting_manager_id" defaultValue={employee?.reporting_manager_id ?? ""} className={inputClass}>
          <option value="">No linked manager yet</option>
          {managers.filter((manager) => manager.id !== employee?.id).map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name} ({manager.employee_code})</option>)}
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>Pending manager code<input name="reporting_manager_employee_code" defaultValue={employee?.reporting_manager_employee_code ?? ""} className={inputClass} placeholder="Use only when the manager is not onboarded" /></label>
    </div>
  );
}

function ActionMessage({ state }: { state: EmployeeActionState }) {
  if (state.status === "idle") return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-[11px] font-medium ${state.status === "error" ? "border-[#F4C7C7] bg-[#FFF5F5] text-[#B42318]" : "border-[#B7E4D4] bg-[#F0FBF7] text-[#087A55]"}`}>{state.message}</p>;
}
