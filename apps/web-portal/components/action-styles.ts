export const actionBaseClassName = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const primaryActionClassName = `${actionBaseClassName} h-10 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10px] text-white shadow-[0_10px_24px_rgba(79,70,229,.18)] hover:brightness-110 active:translate-y-px`;

export const secondaryActionClassName = `${actionBaseClassName} h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] text-[#334155] shadow-sm hover:border-[#AEBBDF] hover:bg-[#F8FAFF] active:translate-y-px`;

export const darkActionClassName = `${actionBaseClassName} h-10 rounded-xl bg-[#071D49] px-4 text-[10px] text-white shadow-[0_10px_22px_rgba(7,29,73,.18)] hover:bg-[#0F2A55] active:translate-y-px`;

export const compactPrimaryActionClassName = `${actionBaseClassName} h-9 rounded-lg bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-3 text-[9px] text-white shadow-sm hover:brightness-110 active:translate-y-px`;

export const compactSecondaryActionClassName = `${actionBaseClassName} h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 text-[9px] text-[#0F2A55] shadow-sm hover:border-[#AEBBDF] hover:bg-[#F8FAFF] active:translate-y-px`;

export const compactDarkActionClassName = `${actionBaseClassName} h-9 rounded-lg bg-[#071D49] px-3 text-[9px] text-white shadow-sm hover:bg-[#0F2A55] active:translate-y-px`;

export const compactLightActionClassName = `${actionBaseClassName} h-8 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[8.5px] text-white hover:bg-white/20 active:translate-y-px`;

export const destructiveActionClassName = `${actionBaseClassName} h-10 rounded-xl bg-red-700 px-4 text-[10.5px] text-white shadow-sm hover:bg-red-800 active:translate-y-px focus-visible:ring-red-500`;

export const destructiveSecondaryActionClassName = `${actionBaseClassName} h-10 rounded-xl border border-red-200 bg-white px-4 text-[10.5px] text-red-700 shadow-sm hover:border-red-300 hover:bg-red-50 active:translate-y-px focus-visible:ring-red-500`;
