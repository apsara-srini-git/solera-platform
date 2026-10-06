import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import type { EducationBlock, EducationSection, EducationSource } from "@/lib/patients/education";
import { dict } from "@/lib/patients/i18n";
import type { Lang } from "@/lib/patients/types";

/** Renders one education block (paragraph, note, list or definition list) in reading order. */
export function Block({ block, lang }: { block: EducationBlock; lang: Lang }) {
  switch (block.type) {
    case "p":
      return <p className="text-[15.5px] leading-relaxed text-ink">{block.text[lang]}</p>;
    case "note":
      return (
        <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-[14.5px] leading-relaxed text-sky-950 ring-1 ring-sky-200 ring-inset">
          <Icon name="info" size={16} className="mt-1 shrink-0" />
          <span>{block.text[lang]}</span>
        </p>
      );
    case "list": {
      const L = block.ordered ? "ol" : "ul";
      return (
        <div>
          {block.title && <h3 className="mb-2 text-[15.5px] font-semibold text-ink">{block.title[lang]}</h3>}
          <L className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1.5 pl-6 text-[15.5px] leading-relaxed text-ink marker:text-brand-700`}>
            {block.items.map((it, i) => (
              <li key={i} className="pl-1">
                {it[lang]}
              </li>
            ))}
          </L>
        </div>
      );
    }
    case "definitions":
      return (
        <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {block.items.map((it) => (
            <div key={it.id} id={it.id} className="scroll-mt-24 px-4 py-3 sm:grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
              <dt className="text-[15px] font-semibold text-ink">{it.term[lang]}</dt>
              <dd className="mt-1 text-[14.5px] leading-relaxed text-ink-2 sm:mt-0">{it.definition[lang]}</dd>
            </div>
          ))}
        </dl>
      );
  }
}

export function Sources({ sources, lang }: { sources: EducationSource[]; lang: Lang }) {
  if (sources.length === 0) return null;
  const d = dict(lang);
  return (
    <details className="mt-5 rounded-xl bg-subtle/70 ring-1 ring-line ring-inset" open>
      <summary className="portal-summary flex cursor-pointer items-center justify-between px-4 py-2.5 text-[13px] font-semibold text-ink-2">
        {d.sources} ({sources.length})
        <Icon name="chevronDown" size={15} className="portal-chevron text-muted transition" />
      </summary>
      <ul className="space-y-1.5 px-4 pb-3 text-[13px] leading-snug">
        {sources.map((s) => (
          <li key={`${s.label}|${s.url}`}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="print-url font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800">
              {s.label}
              <span className="sr-only"> {d.opensNewTab}</span>
            </a>
            <span className="text-muted"> · {s.publisher}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SectionView({ section, lang, actions, children, hideBlocks }: { section: EducationSection; lang: Lang; actions?: ReactNode; children?: ReactNode; hideBlocks?: Set<number> }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-h`} className="card scroll-mt-24 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={`${section.id}-h`} className="text-[21px] font-semibold tracking-tight text-ink">
          {section.title[lang]}
        </h2>
        {actions}
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{section.summary[lang]}</p>
      <div className="mt-5 space-y-4">
        {section.blocks.map((b, i) => (hideBlocks?.has(i) ? null : <Block key={i} block={b} lang={lang} />))}
        {children}
      </div>
      <Sources sources={section.sources} lang={lang} />
    </section>
  );
}

export function Toc({ items, label }: { items: { id: string; title: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="portal-noprint">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <ol className="mt-2 space-y-0.5 border-l border-line">
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pr-2 pl-3 text-[14px] leading-snug text-ink-2 hover:border-brand-400 hover:text-ink">
              {it.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
