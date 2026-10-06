"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons, right-aligned in the footer bar. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

/** Hook shared by Modal and Drawer: drives a native <dialog> (focus trap, Esc, inert background for free). */
export function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === d) onClose(); // click on backdrop
    };
    d.addEventListener("cancel", onCancel);
    d.addEventListener("click", onClick);
    return () => {
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("click", onClick);
    };
  }, [onClose]);
  return ref;
}

const W = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

/**
 * Accessible centred dialog.
 * const [open, setOpen] = useState(false);
 * <Modal open={open} onClose={() => setOpen(false)} title="Approve site?" footer={<Button>Approve</Button>}>…</Modal>
 */
export function Modal({ open, onClose, title, description, footer, size = "md", children }: ModalProps) {
  const ref = useDialog(open, onClose);
  const id = useId();
  const closeLabel = UI[useLang()].close;
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      aria-describedby={description ? `${id}-d` : undefined}
      className={cx("ui-dialog m-auto w-[calc(100%-2rem)] overflow-visible rounded-2xl bg-transparent p-0 text-ink backdrop:bg-transparent", W[size])}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
              {description && <p id={`${id}-d`} className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mt-1 -mr-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm text-ink-2">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
