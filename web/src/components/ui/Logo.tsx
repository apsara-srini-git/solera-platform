import { cx } from "./cx";

/** Solera mark: a map pin holding a medical cross ("the right hospital, located"), on a clinical blue → teal tile.
 *  Same drawing as src/app/icon.svg (browser tab). The gradient id is fixed: every copy defines identical stops. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <linearGradient id="solera-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1f63b8" />
          <stop offset="1" stopColor="#0b9a8c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#solera-mark)" />
      <path
        d="M16 27c-.45 0-.86-.22-1.1-.6C11.4 21.3 8.2 17.4 8.2 13.3a7.8 7.8 0 0 1 15.6 0c0 4.1-3.2 8-6.7 13.1-.24.38-.65.6-1.1.6z"
        fill="#fff"
      />
      <path d="M14.6 9.4h2.8v2.5h2.5v2.8h-2.5v2.5h-2.8v-2.5h-2.5v-2.8h2.5z" fill="#1a7aa6" />
    </svg>
  );
}

export function Logo({ className, sub }: { className?: string; sub?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex items-baseline gap-2">
        <span className="text-[17px] font-semibold tracking-tight text-ink">Solera</span>
        {sub && <span className="hidden rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line ring-inset sm:inline">{sub}</span>}
      </span>
    </span>
  );
}
