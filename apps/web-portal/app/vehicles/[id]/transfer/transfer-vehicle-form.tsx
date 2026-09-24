"use client";

import { useMemo, useState } from "react";
import { transferVehicleCustomer } from "./actions";

export type TransferCustomerOption = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
};

export function TransferVehicleForm({
  vehicleId,
  customers,
}: {
  vehicleId: string;
  customers: TransferCustomerOption[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers.slice(0, 12);
    return customers
      .filter((customer) =>
        [customer.customerCode, customer.name, customer.phone].some((value) => value.toLowerCase().includes(needle)),
      )
      .slice(0, 20);
  }, [customers, query]);

  const action = transferVehicleCustomer.bind(null, vehicleId);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="destination_customer_id" value={selectedId} />

      <div>
        <label className="text-[10px] font-bold uppercase tracking-[.08em] text-[#64748B]">Transfer to customer</label>
        <div className="mt-2 rounded-xl border border-[#DCE5EF] bg-white p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer name, code or phone"
            className="h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[12px] text-[#0F172A] outline-none focus:border-[#315B9A]"
          />
          {selected ? (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F1F5F9] px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold text-[#0F172A]">{selected.name}</p>
                <p className="text-[9.5px] text-[#64748B]">{selected.customerCode} · {selected.phone || "No phone"}</p>
              </div>
              <button type="button" onClick={() => setSelectedId("")} className="text-[9.5px] font-bold text-[#315B9A]">Change</button>
            </div>
          ) : (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-[#E2E8F0]">
              {filtered.length ? filtered.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(customer.id);
                    setQuery(customer.name);
                  }}
                  className="flex w-full items-center justify-between border-b border-[#EEF2F7] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#F8FAFC]"
                >
                  <span>
                    <span className="block text-[11px] font-semibold text-[#1E293B]">{customer.name}</span>
                    <span className="block text-[9px] text-[#64748B]">{customer.customerCode}</span>
                  </span>
                  <span className="text-[9.5px] text-[#64748B]">{customer.phone || "—"}</span>
                </button>
              )) : (
                <p className="px-3 py-4 text-[10px] text-[#64748B]">No accessible customer found.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#64748B]">Effective date</span>
          <input
            type="date"
            name="effective_date"
            required
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-2 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[11px] text-[#0F172A]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#64748B]">Reason</span>
          <input
            type="text"
            name="reason"
            required
            minLength={5}
            placeholder="e.g. ownership/customer transfer"
            className="mt-2 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-[11px] text-[#0F172A]"
          />
        </label>
      </div>

      <label className="flex gap-3 rounded-xl border border-[#F1C7A1] bg-[#FFF8F1] p-4">
        <input type="checkbox" name="confirm_everything" required className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block text-[11px] font-bold text-[#8A4A16]">I understand this is a complete transfer</span>
          <span className="mt-1 block text-[10px] leading-5 text-[#7C5A3B]">
            The vehicle cannot be transferred alone. All linked policies, claims, claim documents, commercial/customer references,
            service enquiries and other customer-scoped dependencies tied to this vehicle will move to the selected customer in the same transaction.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-2 border-t border-[#E5ECF5] pt-4">
        <a href={`/vehicles/${vehicleId}`} className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-[10px] font-bold text-[#475569]">Cancel</a>
        <button
          type="submit"
          disabled={!selectedId}
          className="rounded-lg bg-[#17365D] px-4 py-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Transfer vehicle and all dependencies
        </button>
      </div>
    </form>
  );
}
