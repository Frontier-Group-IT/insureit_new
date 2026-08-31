"use client";

export function VehicleSaveActionChooser() {
  return (
    <button
      type="submit"
      name="next_action"
      value="post_save"
      className="rounded-lg bg-[#17365D] px-5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#102A49]"
    >
      Save Vehicle
    </button>
  );
}
