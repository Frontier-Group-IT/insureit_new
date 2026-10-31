"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, Ban, Pencil, Send, Trash2, X } from "lucide-react";

import {
  deletePartnerAssociateAccount,
  resendPartnerAssociateInvite,
  togglePartnerAssociateAccountStatus,
  updatePartnerAssociateAccount,
} from "./actions";
import { AssociateCityFields } from "./associate-city-fields";

type Role = "admin" | "claim_head" | "insurance_head" | "bodyshop_manager";
type Status = "invited" | "active" | "disabled";

type AssociateForMenu = {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  designation: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  role: Role;
  status: Status;
  invited_at: string | null;
};

export function AssociateAccountActionsMenu({
  associate,
  applicationId,
  intermediaryId,
  returnPath,
}: {
  associate: AssociateForMenu;
  applicationId: string;
  intermediaryId: string;
  returnPath: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const showDialog = (dialog: "edit" | "status" | "delete") => {
    if (dialog === "edit") setEditOpen(true);
    if (dialog === "status") setStatusOpen(true);
    if (dialog === "delete") setDeleteOpen(true);
  };

  const commonHidden = (
    <>
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="intermediary_id" value={intermediaryId} />
      <input type="hidden" name="associate_id" value={associate.id} />
      <input type="hidden" name="return_path" value={returnPath} />
    </>
  );

  return (
    <>
      <div role="group" aria-label={`Account actions for ${associate.name}`} className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
        <button type="button" aria-label={`Edit ${associate.name}`} title="Edit" onClick={() => showDialog("edit")} className="grid h-8 w-8 place-items-center rounded-lg text-[#334155] transition hover:bg-[#E8F0FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315FEA]">
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label={`${associate.status === "disabled" ? "Enable" : "Disable"} ${associate.name}`} title={associate.status === "disabled" ? "Enable" : "Disable"} onClick={() => showDialog("status")} className={`grid h-8 w-8 place-items-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315FEA] ${associate.status === "disabled" ? "text-red-600 hover:bg-red-50" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
          <Ban className="h-4 w-4" aria-hidden="true" />
        </button>
        <form action={resendPartnerAssociateInvite} className="inline-flex">
          {commonHidden}
          <ResendInviteButton status={associate.status} invitedAt={associate.invited_at} />
        </form>
        <button type="button" aria-label={`Delete ${associate.name}`} title="Delete" onClick={() => showDialog("delete")} className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {editOpen ? (
        <Modal title="Edit Associate Account" onClose={() => setEditOpen(false)} wide>
          <form action={updatePartnerAssociateAccount}>
            {commonHidden}
            <div className="space-y-4 p-5">
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Name" required>
                  <input name="name" required defaultValue={associate.name} className={inputClass} />
                </Field>
                <Field label="Phone Number" required>
                  <input name="phone_number" required defaultValue={associate.phone_number} inputMode="tel" className={inputClass} />
                </Field>
                <Field label="Email" required>
                  <input
                    value={associate.email}
                    readOnly
                    disabled
                    title="Email is locked because it is the associate's portal login ID."
                    className={`${inputClass} cursor-not-allowed bg-[#F8FAFC] text-[#64748B]`}
                  />
                </Field>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Designation" required>
                  <input name="designation" required defaultValue={associate.designation} className={inputClass} />
                </Field>
                <Field label="Role" required>
                  <select name="role" required defaultValue={associate.role} className={inputClass}>
                    <option value="admin" disabled={associate.role !== "admin"}>Admin</option>
                    <option value="claim_head">Claim Head</option>
                    <option value="insurance_head">Insurance Head</option>
                    <option value="bodyshop_manager">Bodyshop Manager</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                <Field label="Address">
                  <input name="address" defaultValue={associate.address ?? ""} className={inputClass} placeholder="Address" />
                </Field>
                <AssociateCityFields
                  defaultCity={associate.city ?? ""}
                  defaultState={associate.state ?? ""}
                  defaultPostalCode={associate.postal_code ?? ""}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#E7ECF3] bg-[#FBFCFE] px-5 py-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <SaveChangesButton />
            </div>
          </form>
        </Modal>
      ) : null}

      {statusOpen ? (
        <Modal
          title={associate.status === "disabled" ? "Enable Associate Account" : "Disable Associate Account"}
          onClose={() => setStatusOpen(false)}
        >
          <form action={togglePartnerAssociateAccountStatus}>
            {commonHidden}
            <div className="space-y-2 px-5 py-4 text-[11px] text-[#334155]">
              <p className="font-semibold">{associate.name}</p>
              <p>{associate.status === "disabled"
                ? "Enable this associate's portal access?"
                : "Disable this associate's portal access? Their account and data will be preserved."}</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#E7ECF3] bg-[#FBFCFE] px-5 py-3">
              <button type="button" onClick={() => setStatusOpen(false)} className="h-9 rounded-md border border-[#CBD5E1] px-4 text-[10.5px] font-semibold">
                Cancel
              </button>
              <StatusSubmitButton enable={associate.status === "disabled"} />
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteOpen ? (
        <DeleteAssociateConfirmation
          associateName={associate.name}
          onClose={() => setDeleteOpen(false)}
          hiddenFields={commonHidden}
        />
      ) : null}

    </>
  );
}


const RESEND_COOLDOWN_SECONDS = 60;

function ResendInviteButton({
  status,
  invitedAt,
}: {
  status: Status;
  invitedAt: string | null;
}) {
  const { pending } = useFormStatus();
  const [remaining, setRemaining] = useState(0);
  // The backend owns the cooldown. Only a confirmed invitation timestamp
  // should disable this control, never an unconfirmed local attempt.

  useEffect(() => {
    const invitedUntil = invitedAt
      ? new Date(invitedAt).getTime() + RESEND_COOLDOWN_SECONDS * 1000
      : 0;
    const cooldownUntil = invitedUntil;

    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setRemaining(seconds);
    };

    updateRemaining();
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [invitedAt]);

  const disabled = status === "disabled" || pending || remaining > 0;
  const title = status === "disabled"
    ? "Enable this account before resending the link."
    : remaining > 0
      ? `You can resend the link in ${remaining} seconds.`
      : undefined;

  return (
    <button
      type="submit"
      aria-label={pending ? "Sending link" : remaining > 0 ? `Resend link in ${remaining} seconds` : "Resend link"}
      disabled={disabled}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315FEA] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Send className="h-3.5 w-3.5 text-[#64748B]" />

    </button>
  );
}

function StatusSubmitButton({ enable }: { enable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-9 rounded-md bg-[#17365D] px-4 text-[10.5px] font-semibold text-white disabled:opacity-60">
      {pending ? "Updating..." : enable ? "Enable account" : "Disable account"}
    </button>
  );
}

function SaveChangesButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex h-9 min-w-[108px] items-center justify-center rounded-md border border-[#315FEA] bg-[#315FEA] px-4 text-[10.5px] font-semibold text-white shadow-sm transition hover:bg-[#2851D9] disabled:cursor-not-allowed disabled:border-[#9DB2F7] disabled:bg-[#9DB2F7] disabled:text-white/80 disabled:shadow-none"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

function DeletePermanentlyButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:bg-red-300"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{pending ? "Deleting..." : "Delete permanently"}
    </button>
  );
}

function DeleteAssociateConfirmation({
  associateName,
  onClose,
  hiddenFields,
}: {
  associateName: string;
  onClose: () => void;
  hiddenFields: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="associate-delete-confirm-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 z-[10000] m-auto w-[calc(100%-32px)] max-w-[420px] overflow-hidden rounded-2xl bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,.22)] backdrop:bg-slate-950/35"
    >
      <div>
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="associate-delete-confirm-title" className="text-[14px] font-bold text-[#17203A]">
              Permanently delete associate account?
            </h3>
            <p className="mt-1 break-words text-[11px] font-medium text-[#64748B]">{associateName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close delete confirmation" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#94A3B8] hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-5 pb-4 pt-3 text-[11px] leading-5 text-[#64748B]">
          This action cannot be undone. The associate account and any removable login access will be permanently deleted. Protected business history may prevent deletion.
        </p>
        <form action={deletePartnerAssociateAccount} className="flex gap-2 border-t border-[#E7ECF3] px-5 py-3">
          {hiddenFields}
          <button type="button" onClick={onClose} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[#D8DEE9] bg-white text-[11px] font-semibold text-[#334155] hover:bg-slate-50">
            Cancel
          </button>
          <DeletePermanentlyButton />
        </form>
      </div>
    </dialog>,
    document.body,
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className={`fixed inset-0 z-[10000] m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white p-0 shadow-[0_24px_70px_rgba(15,23,42,.22)] backdrop:bg-slate-950/35 backdrop:backdrop-blur-[1px] ${wide ? "max-w-[1080px]" : "max-w-xl"}`}
    >
      <div className="flex max-h-[calc(100dvh-32px)] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E7ECF3] px-5 py-4">
          <h3 className="text-[13px] font-semibold text-[#17203A]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">{label}{required ? <span className="text-red-600"> *</span> : null}</span>{children}</label>;
}
