import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";

import { AppShell } from "@/components/shell";
import { PendingButton } from "@/components/voice/pending-button";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export default async function NewVoiceCampaignPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    redirect("/access-denied");
  }

  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <AppShell title="New Voice Campaign">
      <div className="mx-auto max-w-3xl space-y-3 pb-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/system/voice-integration"
            className="inline-flex items-center gap-1.5 text-[9px] font-bold text-[#536984]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voice Integration
          </Link>
          <span className="rounded-full border border-[#D4E3F6] bg-white px-3 py-1 text-[8px] font-bold text-[#3156B8]">
            Maximum 500 source rows
          </span>
        </div>

        <section className="rounded-2xl border border-[#DDE6F0] bg-white p-5 shadow-[0_5px_18px_rgba(31,55,86,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[20px] font-black tracking-[-0.02em] text-[#142B50]">
                Add voice campaign
              </h1>
              <p className="mt-1 text-[10px] leading-5 text-[#687B96]">
                Upload a standard RC + mobile campaign, or the Tata Commercial workbook. For Tata files,
                only the Renewal sheet is imported; Breaking Case is excluded. Existing insurer,
                policy, expiry, customer and vehicle context is preserved before calls can start.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-semibold text-amber-800">
              {error}
            </div>
          ) : null}

          <form
            action="/api/system/voice-integration/campaigns"
            method="post"
            encType="multipart/form-data"
            className="mt-5 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-[.06em] text-[#7A8AA0]">
                  Campaign name
                </span>
                <input
                  name="name"
                  required
                  maxLength={120}
                  placeholder="Tata Commercial Renewal"
                  className="h-10 w-full rounded-lg border border-[#D6E0EC] px-3 text-[10px] font-semibold text-[#29415F] outline-none focus:border-[#3156B8]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[8px] font-black uppercase tracking-[.06em] text-[#7A8AA0]">
                  Description
                </span>
                <input
                  name="description"
                  maxLength={500}
                  placeholder="Upcoming Tata Commercial renewals"
                  className="h-10 w-full rounded-lg border border-[#D6E0EC] px-3 text-[10px] text-[#29415F] outline-none focus:border-[#3156B8]"
                />
              </label>
            </div>

            <label className="block rounded-xl border border-dashed border-[#BFD0E5] bg-[#F8FBFF] p-5 text-center">
              <Upload className="mx-auto h-5 w-5 text-[#3156B8]" />
              <span className="mt-2 block text-[10px] font-black text-[#29415F]">
                Upload Excel sheet
              </span>
              <span className="mt-1 block text-[8.5px] text-[#72849C]">
                Standard: <strong>RC No.</strong> + <strong>Mobile No.</strong>. Tata workbook:
                <strong> Renewal</strong> sheet is detected automatically; <strong>Breaking Case</strong> is ignored.
              </span>
              <input
                type="file"
                name="file"
                required
                accept=".xlsx,.xls,.csv"
                className="mt-3 block w-full text-[9px] text-[#61758F]"
              />
            </label>

            <div className="rounded-xl bg-[#F4F7FB] px-3.5 py-3 text-[8.5px] leading-5 text-[#64748B]">
              Upload does not call customers. Tata renewal rows sharing one usable mobile are grouped into one
              calling prospect with multi-vehicle context. DNC/closed RCs remain held, RC enrichment
              still runs before dispatch, and starting calls remains a separate explicit action.
            </div>

            <div className="flex justify-end gap-2">
              <Link
                href="/system/voice-integration"
                className="inline-flex h-9 items-center rounded-lg border border-[#D6E0EC] px-4 text-[9px] font-bold text-[#536984]"
              >
                Cancel
              </Link>
              <PendingButton
                pendingLabel="Creating campaign…"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#102A56] px-4 text-[9px] font-bold text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                Create & fetch details
              </PendingButton>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
