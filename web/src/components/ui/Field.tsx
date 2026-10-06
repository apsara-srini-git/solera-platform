import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { OptionalTag } from "./OptionalTag";

export function Label({ className, children, optional, ...rest }: LabelHTMLAttributes<HTMLLabelElement> & { optional?: boolean | string }) {
  return (
    <label className={cx("label", className)} {...rest}>
      {children}
      {optional && <span className="ml-1 font-normal text-muted">{typeof optional === "string" ? optional : <OptionalTag />}</span>}
    </label>
  );
}

export interface FieldProps {
  label?: ReactNode;
  /** id of the control, links label + hint + error. */
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean | string;
  /** Shown at the right of the label row (e.g. a SourceBadge or InfoTip). */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error. Give the control id={htmlFor} and aria-describedby={`${htmlFor}-hint`} if you use hint.
 * <Field label="Work email" htmlFor="email" hint="We never share it with sites"><Input id="email" name="email" /></Field>
 */
export function Field({ label, htmlFor, hint, error, optional, aside, className, children }: FieldProps) {
  return (
    <div className={cx("min-w-0", className)}>
      {(label || aside) && (
        <div className="flex items-end justify-between gap-2">
          {label && <Label htmlFor={htmlFor} optional={optional}>{label}</Label>}
          {aside && <div className="mb-1.5 shrink-0">{aside}</div>}
        </div>
      )}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-[13px] text-rose-700" role="alert">{error}</p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="mt-1.5 text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx("input h-10", className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx("input min-h-24 leading-relaxed", className)} aria-invalid={invalid || undefined} {...rest} />;
}

/** Native select; the chevron comes from the `select.input` rule in globals.css. */
export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx("input h-10", className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}

/** Checkbox / radio with label to the right. */
export function Check({ label, hint, className, type = "checkbox", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode; type?: "checkbox" | "radio" }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2.5 text-sm text-ink", className)}>
      <input type={type} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600" {...rest} />
      <span>
        {label}
        {hint && <span className="mt-0.5 block text-[13px] text-muted">{hint}</span>}
      </span>
    </label>
  );
}
