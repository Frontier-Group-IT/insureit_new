"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, Ban, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  // Enable with ?debugAssociateActions=1. No account or personal data is logged.
  const trace = (stage: string) => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugAssociateActions") === "1") {
      console.info("[associate-actions]", stage);
    }
  };
  const showDialog = (dialog: "edit" | "status" | "delete") => {
    trace("handler:" + dialog);
    setOpen(false);
    if (dialog === "edit") setEditOpen(true);
    if (dialog === "status") setStatusOpen(true);
    if (dialog === "delete") setDeleteOpen(true);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDialogElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditOpen(false);
        setDeleteOpen(false);
        setStatusOpen(false);
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function positionMenu() {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = 154;
      const gap = 8;
      const viewportPadding = 12;

      const left = Math.min(
        Math.max(viewportPadding, rect.right - menuWidth),
        window.innerWidth - menuWidth - viewportPadding,
      );
      const fitsBelow = rect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding;
      const top = fitsBelow
        ? rect.bottom + gap
        : Math.max(viewportPadding, rect.top - gap - menuHeight);

      setMenuPosition({ top, left });
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    trace("state:menu=" + open + ":edit=" + editOpen + ":status=" + statusOpen + ":delete=" + deleteOpen);
  }, [open, editOpen, statusOpen, deleteOpen]);

  // Render the action dropdown in the browser top layer. Background UI can no
  // longer intercept pointer events intended for the menu.
  useEffect(() => {
    const dialog = menuRef.current;
    if (!open || !menuPosition || !dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [open, Boolean(menuPosition)]);

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
      <div ref={rootRef} className="relative inline-flex">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Actions for ${associate.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => { trace("trigger:click"); setOpen((value) => !value); }}
          className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#334155] transition hover:border-[#DCE5EF] hover:bg-[#F1F5F9]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {open && menuPosition
          ? createPortal(
              <dialog
                ref={menuRef}
                aria-label={`Actions for ${associate.name}`}
                onCancel={(event) => { event.preventDefault(); setOpen(false); }}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setOpen(false);
                }}
                style={{ top: menuPosition.top, left: menuPosition.left }}
                className="fixed m-0 w-44 overflow-hidden rounded-xl border border-[#DCE5EF] bg-white p-0 shadow-[0_18px_45px_rgba(15,23,42,.18)] backdrop:bg-transparent"
              >
                <div
                  role="menu"
                  className="py-1.5"
                  onPointerDownCapture={() => trace("menu:pointerdown:capture")}
                  onClickCapture={() => trace("menu:click:capture")}
                  onClick={(event) => event.stopPropagation()}
                >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => showDialog("edit")}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#64748B]" />
                  Edit
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => showDialog("status")}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <Ban className="h-3.5 w-3.5 text-[#64748B]" />
                  {associate.status === "disabled" ? "Enable" : "Disable"}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => showDialog("delete")}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>

                <form action={resendPartnerAssociateInvite}>
                  {commonHidden}
                  <ResendInviteButton
                    status={associate.status}
                    invitedAt={associate.invited_at}
                  />
                </form>
                </div>
              </dialog>,
              document.body,
            )
          : null}
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
      role="menuitem"
      disabled={disabled}
      title={title}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Send className="h-3.5 w-3.5 text-[#64748B]" />
      {pending ? "Sending..." : remaining > 0 ? `Resend in ${remaining}s` : "Resend Link"}
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
