"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ButtonLink, Icon } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { COMMON } from "@/lib/i18n/pro";

/** Where to come back to after logging in: the current page (path + query), or the pending target on the auth pages. */
function useNext(): string {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname === "/login" || pathname === "/signup") {
    const next = params.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
  }
  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ""}`;
}

const withNext = (href: string, next: string) => (next === "/" ? href : `${href}?next=${encodeURIComponent(next)}`);

function HeaderLinks() {
  const next = useNext();
  const t = COMMON[useLang()];
  return (
    <div className="flex items-center gap-1.5">
      <ButtonLink href={withNext("/login", next)} variant="ghost" size="sm" className="hidden sm:inline-flex">
        {t.logIn}
      </ButtonLink>
      <ButtonLink href={withNext("/signup", next)} size="sm">
        {t.signUpFree}
      </ButtonLink>
    </div>
  );
}

function MenuLogin() {
  const next = useNext();
  const t = COMMON[useLang()];
  return (
    <Link href={withNext("/login", next)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle">
      <Icon name="user" size={15} /> {t.logIn}
    </Link>
  );
}

/** Header "Log in" / "Sign up free" links that bring the user back to the page they were on. */
export function AuthLinks() {
  const t = COMMON[useLang()];
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-1.5">
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            {t.logIn}
          </ButtonLink>
          <ButtonLink href="/signup" size="sm">
            {t.signUpFree}
          </ButtonLink>
        </div>
      }
    >
      <HeaderLinks />
    </Suspense>
  );
}

/** Phone-menu "Log in" link, with the same return target. */
export function MenuLoginLink() {
  const t = COMMON[useLang()];
  return (
    <Suspense
      fallback={
        <Link href="/login" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle">
          <Icon name="user" size={15} /> {t.logIn}
        </Link>
      }
    >
      <MenuLogin />
    </Suspense>
  );
}
