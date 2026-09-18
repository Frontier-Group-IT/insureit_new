"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { Ban, MoreVertical, Pencil, Send, Trash2, X } from "lucide-react";

import {
  deletePartnerAssociateAccount,
  resendPartnerAssociateInvite,
  togglePartnerAssociateAccountStatus,
  updatePartnerAssociateAccount,
} from "./actions";

type Role = "admin" | "claim_head" | "insurance_head" | "bodyshop_manager";
type Status = "invited" | "active" | "disabled";

type AssociateForMenu = {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  designation: string;
  role: Role;
  status: Status;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditOpen(false);
        setDeleteOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
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
          onClick={() => setOpen((value) => !value)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#334155] transition hover:border-[#DCE5EF] hover:bg-[#F1F5F9]"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {open && menuPosition
          ? createPortal(
              <div
                ref={menuRef}
                role="menu"
                style={{ top: menuPosition.top, left: menuPosition.left }}
                className="fixed z-[200] w-44 overflow-hidden rounded-xl border border-[#DCE5EF] bg-white py-1.5 shadow-[0_18px_45px_rgba(15,23,42,.18)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setEditOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#64748B]" />
                  Edit
                </button>

                <form action={togglePartnerAssociateAccountStatus}>
                  {commonHidden}
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC]"
                  >
                    <Ban className="h-3.5 w-3.5 text-[#64748B]" />
                    {associate.status === "disabled" ? "Enable" : "Disable"}
                  </button>
                </form>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>

                <form action={resendPartnerAssociateInvite}>
                  {commonHidden}
                  <button
                    type="submit"
                    role="menuitem"
                    disabled={associate.status === "disabled"}
                    title={associate.status === "disabled" ? "Enable this account before resending the link." : undefined}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[10.5px] font-medium text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5 text-[#64748B]" />
                    Resend Link
                  </button>
                </form>
              </div>,
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
                <Field label="Name">
                  <input name="name" required defaultValue={associate.name} className={inputClass} />
                </Field>
                <Field label="Phone Number">
                  <input name="phone_number" required defaultValue={associate.phone_number} inputMode="tel" className={inputClass} />
                </Field>
                <Field label="Email">
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
                <Field label="Designation">
                  <input name="designation" required defaultValue={associate.designation} className={inputClass} />
                </Field>
                <Field label="Role">
                  <select name="role" required defaultValue={associate.role} className={inputClass}>
                    <option value="admin" disabled>Admin</option>
                    <option value="claim_head">Claim Head</option>
                    <option value="insurance_head">Insurance Head</option>
                    <option value="bodyshop_manager">Bodyshop Manager</option>
                  </select>
                </Field>
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

      {deleteOpen ? (
        <Modal title="Delete Associate Account" onClose={() => setDeleteOpen(false)}>
          <form action={deletePartnerAssociateAccount}>
            {commonHidden}
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-[11px] font-semibold text-rose-700">
                  Permanently delete {associate.name}?
                </p>
                <p className="mt-1 text-[10px] leading-5 text-rose-600">
                  This removes the associate login and account permanently. This action cannot be undone.
                </p>
              </div>
              <div className="rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] px-4 py-3 text-[10.5px] font-medium text-[#334155]">
                {associate.email}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#E7ECF3] bg-[#FBFCFE] px-5 py-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <DeletePermanentlyButton />
            </div>
          </form>
        </Modal>
      ) : null}

    </>
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
      className="inline-flex h-9 min-w-[138px] items-center justify-center rounded-md border border-rose-600 bg-rose-600 px-4 text-[10.5px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:border-rose-300 disabled:bg-rose-300"
    >
      {pending ? "Deleting..." : "Delete Permanently"}
    </button>
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
  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_24px_70px_rgba(15,23,42,.22)] md:translate-x-6 ${wide ? "max-w-[1080px]" : "max-w-xl"}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E7ECF3] px-5 py-4">
          <h3 className="text-[13px] font-semibold text-[#17203A]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">{label}</span>{children}</label>;
}
