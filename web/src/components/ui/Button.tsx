import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] rounded-md",
  md: "",
  lg: "h-11 px-5 text-[15px]",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and keeps its width stable. */
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  /** Stretch to the container width. */
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

export type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
export type ButtonLinkProps = CommonProps & { href: string; target?: string; rel?: string; prefetch?: boolean; "aria-label"?: string };

export function buttonClass({ variant = "primary", size = "md", block, className }: Pick<CommonProps, "variant" | "size" | "block" | "className"> = {}) {
  return cx(VARIANT[variant], SIZE[size], block && "w-full", className);
}

function Inner({ loading, icon, iconRight, size, children }: CommonProps) {
  const s = size === "lg" ? 18 : size === "sm" ? 14 : 16;
  return (
    <>
      {loading ? <Spinner size={s} /> : icon ? <Icon name={icon} size={s} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={s} />}
    </>
  );
}

/**
 * <Button variant="primary" loading={pending}>Send questionnaire</Button>
 * Works in server and client components (no hooks).
 */
export function Button({ variant, size, loading, icon, iconRight, block, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "submit"}
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner loading={loading} icon={icon} iconRight={iconRight} size={size}>{children}</Inner>
    </button>
  );
}

/** Same look as Button, renders a Next <Link>. External links (http…) open in a new tab. */
export function ButtonLink({ variant, size, loading, icon, iconRight, block, className, children, href, target, rel, ...rest }: ButtonLinkProps) {
  const external = /^https?:/.test(href);
  return (
    <Link
      href={href}
      target={target ?? (external ? "_blank" : undefined)}
      rel={rel ?? (external ? "noopener noreferrer" : undefined)}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      <Inner loading={loading} icon={icon} iconRight={iconRight} size={size}>{children}</Inner>
    </Link>
  );
}
