import { markCustomerActivityHandled, markCustomerActivityInProgress, markCustomerActivitySeen } from "./activity-actions";

export function ActivityWorkButton({ activityId }: { activityId: string }) {
  return <ActivityStatusButton activityId={activityId} label="Work" action={markCustomerActivityInProgress} />;
}

export function ActivityHandledButton({ activityId }: { activityId: string }) {
  return <ActivityStatusButton activityId={activityId} label="Handled" action={markCustomerActivityHandled} primary />;
}

export function ActivitySeenButton({ activityId }: { activityId: string }) {
  return <ActivityStatusButton activityId={activityId} label="Seen" action={markCustomerActivitySeen} />;
}

function ActivityStatusButton({ activityId, label, action, primary = false }: { activityId: string; label: string; action: (formData: FormData) => Promise<void>; primary?: boolean }) {
  const className = primary
    ? "rounded-lg border border-[#071D49] bg-[#071D49] px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#12356C]"
    : "rounded-lg border border-[#D6E0EC] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]";

  return (
    <form action={action}>
      <input type="hidden" name="activityId" value={activityId} />
      <button type="submit" className={className}>{label}</button>
    </form>
  );
}
