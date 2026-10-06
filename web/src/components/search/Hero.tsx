"use client";

import { Icon, SourceChip, type IconName } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";

const PROMISE_ICONS: IconName[] = ["doc", "eyeOff", "user", "map"];

export function Hero({
  hospitals,
  trials,
}: {
  hospitals: number;
  trials: number;
}) {
  const t = SEARCH[useLang()].hero;
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
          <SourceChip
            sources={["catalogue", "reec", "ctgov"]}
            title={t.stats(hospitals, trials)}
            note={t.statsNote}
            ariaLabel={t.statsAria(hospitals, trials)}
          >
            <span className="num">{t.stats(hospitals, trials)}</span>
          </SourceChip>
        </span>
        <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-[2.5rem]">
          {t.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2 sm:hidden">
          {t.leadShort}
        </p>
        <p className="mt-3 hidden text-[15.5px] leading-relaxed text-ink-2 sm:block">
          {t.leadLong}
        </p>
      </div>
      <div className="hidden lg:block lg:w-[460px]">
        <ul className="grid gap-2">
          {t.promises.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-xs"
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Icon name={PROMISE_ICONS[i]} size={15} />
              </span>
              <span className="text-[13px] leading-snug">
                <span className="font-semibold text-ink">{p.title}</span>{" "}
                <span className="text-muted">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
