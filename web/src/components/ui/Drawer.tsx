"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { useDialog } from "./Modal";
import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
  children?: ReactNode;
}

const W = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl" };

/** Right-hand side panel (full screen on phones). Use for filters on mobile or a quick site preview from the map. */
export function Drawer({ open, onClose, title, description, footer, width = "md", children }: DrawerProps) {
  const ref = useDialog(open, onClose);
  const id = useId();
  const closeLabel = UI[useLang()].close;
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      className={cx("ui-dialog ui-drawer fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent p-0 text-ink", W[width])}
    >
      {open && (
        <div className="flex h-full flex-col border-l border-line bg-surface shadow-pop">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
