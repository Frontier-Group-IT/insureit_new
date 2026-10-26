"use client";

import { useActionState } from "react";

export type SaveVehicleState = { error: string | null };
export const initialSaveVehicleState: SaveVehicleState = { error: null };

export function CustomerVehicleForm({
  action,
  children,
}: {
  action: (state: SaveVehicleState, formData: FormData) => Promise<SaveVehicleState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialSaveVehicleState);

  return (
    <form id="customer-add-vehicle-form" action={formAction} className="customer-workflow space-y-3" aria-busy={pending}>
      {state.error ? (
        <div role="alert" aria-live="assertive" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-800">
          {state.error}
        </div>
      ) : null}
      <fieldset disabled={pending} className="space-y-3 disabled:opacity-70">
        {children}
      </fieldset>
    </form>
  );
}
