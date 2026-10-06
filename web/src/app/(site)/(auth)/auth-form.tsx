"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Icon, Input, type IconName } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { AUTH } from "@/lib/i18n/pro/auth";
import { login, signup } from "../actions";

const POINT_ICONS: IconName[] = ["map", "eyeOff", "shield"];

export default function AuthForm({ mode, next }: { mode: "signup" | "login"; next: string }) {
  const [state, action, pending] = useActionState(mode === "signup" ? signup : login, undefined);
  const signup_ = mode === "signup";
  const t = AUTH[useLang()];
  return (
    <div className="mx-auto grid max-w-5xl items-stretch gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
      {/* Value panel (desktop) */}
      <aside className="relative hidden overflow-hidden rounded-2xl bg-brand-800 p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <p className="relative text-xs font-semibold tracking-[0.14em] text-brand-200 uppercase">{t.eyebrow}</p>
        <h2 className="relative mt-3 text-[28px] leading-tight font-semibold tracking-tight">
          {t.panelTitle}
        </h2>
        <ul className="relative mt-8 space-y-5">
          {t.points.map((p, i) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon name={POINT_ICONS[i]} size={18} />
              </span>
              <span>
                <span className="block text-[15px] font-medium">{p.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-brand-100/80">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="relative mt-auto pt-10 text-xs text-brand-200/80">
          {t.panelSources}
        </p>
      </aside>

      {/* Form */}
      <div className="flex flex-col justify-center py-2 lg:py-8">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{signup_ ? t.signupTitle : t.loginTitle}</h1>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {signup_ ? t.signupLead : t.loginLead}
          </p>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2 lg:hidden">
            {t.mobilePoints.map((x) => (
              <li key={x} className="inline-flex items-center gap-1.5"><Icon name="check" size={14} className="text-brand-600" />{x}</li>
            ))}
          </ul>

          <form action={action} className="mt-7 space-y-4" noValidate={false}>
            <input type="hidden" name="next" value={next} />
            {signup_ && (
              <>
                <Field label={t.name} htmlFor="name">
                  <Input id="name" name="name" required autoComplete="name" />
                </Field>
                <Field label={t.company} htmlFor="organisation" optional={t.optional} hint={t.companyHint}>
                  <Input id="organisation" name="organisation" placeholder={t.companyPlaceholder} autoComplete="organization" aria-describedby="organisation-hint" />
                </Field>
              </>
            )}
            <Field label={t.email} htmlFor="email">
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder={t.emailPlaceholder} />
            </Field>
            <Field label={t.password} htmlFor="password" hint={signup_ ? t.passwordHint : undefined}>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={signup_ ? 8 : undefined}
                autoComplete={signup_ ? "new-password" : "current-password"}
                aria-describedby={signup_ ? "password-hint" : undefined}
              />
            </Field>
            {state?.error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800 ring-1 ring-rose-200 ring-inset">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                {state.error}
              </p>
            )}
            <Button size="lg" block loading={pending}>
              {signup_ ? t.createAccount : t.logIn}
            </Button>
            {signup_ && (
              <p className="text-center text-xs leading-relaxed text-muted">
                {t.acceptPrefix}
                <Link href="/terms" className="underline decoration-line-strong underline-offset-2 hover:text-ink">{t.acceptLink}</Link>
                {t.acceptSuffix}
              </p>
            )}
          </form>

          <div className="mt-8 border-t border-line pt-5 text-center text-sm text-ink-2">
            {signup_ ? (
              <>{t.haveAccount}{" "}
                <Link className="font-medium text-brand-700 hover:underline" href={`/login?next=${encodeURIComponent(next)}`}>{t.logIn}</Link></>
            ) : (
              <>{t.newTo}{" "}
                <Link className="font-medium text-brand-700 hover:underline" href={`/signup?next=${encodeURIComponent(next)}`}>{t.createFree}</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
