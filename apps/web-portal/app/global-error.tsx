"use client";

import { useEffect } from "react";
import { reportClientRuntimeError } from "@/components/client-runtime-error-monitor";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientRuntimeError("global-boundary", error);
  }, [error]);

  const serverActionMismatch = /UnrecognizedActionError|Server Action .* was not found|unexpected response was received from the server/i.test(`${error.name} ${error.message}`);

  return (
    <html lang="en">
      <body className="m-0 bg-[#F4F7FB] font-sans text-[#172846]">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-md rounded-2xl border border-[#DFE7F2] bg-white p-6 text-center shadow-[0_16px_40px_rgba(30,58,110,0.08)]">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#EEF4FF] text-lg font-black text-[#1F5FC4]">!</div>
            <h1 className="mt-4 text-lg font-extrabold">{serverActionMismatch ? "Portal updated — reload required" : "InsureIt needs to reload this page"}</h1>
            <p className="mt-2 text-sm leading-6 text-[#6F8097]">
              {serverActionMismatch ? "The browser and server are using different action versions, or the server returned an unexpected response. Reload before retrying. Check whether the previous submission succeeded." : "The page encountered an error. Check whether your previous submission succeeded before retrying."}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-[#173B68] px-4 py-2.5 text-sm font-bold text-white"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.assign(window.location.pathname + window.location.search)}
                className="rounded-lg border border-[#CFD9E8] bg-white px-4 py-2.5 text-sm font-bold text-[#27415F]"
              >
                Reload page
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
