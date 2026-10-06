import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, cx } from "@/components/ui";
import { dict, fmt, formatNumber } from "@/lib/patients/i18n";
import { AGE_GROUP_LABELS, SORT_LABELS, SORT_NOTE, areaLabel } from "@/lib/patients/labels";
import type { HospitalAggregate, Lang, PatientHospital, PatientQuery } from "@/lib/patients/types";

export const SEARCH_FORM_ID = "patient-search";

const chipBase =
  "relative inline-flex h-9 max-w-full items-center gap-1 rounded-full border text-[13px] transition focus-within:ring-2 focus-within:ring-brand-500/40";

/** A filter "chip" holding a native select (keyboard and screen-reader friendly, works without JS). */
export function SelectChip({
  id,
  name,
  label,
  value,
  options,
  anyLabel,
  className,
}: {
  id: string;
  name: string;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  anyLabel: string;
  className?: string;
}) {
  const on = !!value;
  return (
    <div className={cx(chipBase, on ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line-strong bg-surface text-ink-2 hover:border-ink-2/30", "pl-3", className)}>
      <label htmlFor={id} className="shrink-0 font-medium">
        {label}:
      </label>
      <select
        key={value ?? ""}
        id={id}
        name={name}
        defaultValue={value ?? ""}
        form={SEARCH_FORM_ID}
        autoComplete="off"
        className={cx("h-full min-w-0 max-w-[13rem] cursor-pointer appearance-none truncate rounded-full bg-transparent pr-7 pl-0.5 outline-none sm:max-w-[16rem]", on ? "font-semibold" : "")}
      >
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="pointer-events-none absolute right-2.5 text-muted" />
    </div>
  );
}

export function CheckChip({ id, name, label, checked }: { id: string; name: string; label: string; checked: boolean }) {
  return (
    <label
      htmlFor={id}
      className={cx(
        chipBase,
        "cursor-pointer gap-2 px-3",
        checked ? "border-brand-300 bg-brand-50 font-semibold text-brand-800" : "border-line-strong bg-surface font-medium text-ink-2 hover:border-ink-2/30",
      )}
    >
      <input key={String(checked)} id={id} type="checkbox" name={name} value="1" defaultChecked={checked} form={SEARCH_FORM_ID} autoComplete="off" className="h-4 w-4 accent-brand-600" />
      {label}
    </label>
  );
}

export function FilterChips({
  query,
  lang,
  areas,
  hospitals,
}: {
  query: PatientQuery;
  lang: Lang;
  areas: { area: string; count: number }[];
  hospitals: PatientHospital[];
}) {
  const d = dict(lang);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{d.filtersTitle}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <SelectChip
          id="f-age"
          name="age"
          label={d.filterAge}
          value={query.age}
          anyLabel={d.anyAge}
          options={(["child", "adult", "older"] as const).map((a) => ({ value: a, label: AGE_GROUP_LABELS[a][lang] }))}
        />
        <SelectChip
          id="f-area"
          name="area"
          label={d.filterArea}
          value={query.area}
          anyLabel={d.anyArea}
          options={areas.map((a) => ({ value: a.area, label: `${areaLabel(a.area, lang)} (${formatNumber(a.count, lang)})` }))}
        />
        <SelectChip
          id="f-hospital"
          name="hospital"
          label={d.filterHospital}
          value={query.hospital}
          anyLabel={d.anyHospital}
          options={hospitals.map((h) => ({ value: h.id, label: h.name }))}
        />
        <SelectChip
          id="f-status"
          name="status"
          label={d.filterStatus}
          value={query.status}
          anyLabel={d.anyStatus}
          options={[
            { value: "recruiting", label: d.statusRecruiting },
            { value: "not_yet", label: d.statusNotYet },
          ]}
        />
        <CheckChip id="f-healthy" name="healthy" label={d.filterHealthy} checked={!!query.healthyVolunteers} />
        <CheckChip id="f-stale" name="stale" label={d.filterStale} checked={!!query.includeStale} />
        <button type="submit" form={SEARCH_FORM_ID} data-apply className="btn-secondary h-9 rounded-full">
          {d.applyFilters}
        </button>
      </div>
    </fieldset>
  );
}

export function SortSelect({ query, lang }: { query: PatientQuery; lang: Lang }) {
  const d = dict(lang);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <label htmlFor="f-sort" className="shrink-0 text-[13px] font-medium text-ink-2">
          {d.sortLabel}
        </label>
        <select key={query.sort ?? "updated"} id="f-sort" name="sort" form={SEARCH_FORM_ID} autoComplete="off" defaultValue={query.sort ?? "updated"} className="input h-9 w-auto max-w-[calc(100vw-8rem)] py-0 text-[13px] sm:max-w-none" aria-describedby="sort-note">
          {(["updated", "alpha", "hospitals"] as const).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s][lang]}
            </option>
          ))}
        </select>
      </div>
      <p id="sort-note" className="text-[12px] text-muted">
        {SORT_NOTE[lang]}
      </p>
    </div>
  );
}

export interface ActiveFilter {
  label: string;
  removeHref: string;
}

export function ActiveFilters({ filters, clearHref, lang }: { filters: ActiveFilter[]; clearHref: string; lang: Lang }) {
  if (filters.length === 0) return null;
  const d = dict(lang);
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label={d.activeFilters} role="group">
      {filters.map((f) => (
        <Link
          key={f.label}
          href={f.removeHref}
          scroll={false}
          aria-label={fmt(d.removeFilter, { label: f.label })}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-ink/[0.06] pr-2 pl-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-ink/10 hover:text-ink"
        >
          {f.label}
          <Icon name="x" size={13} />
        </Link>
      ))}
      <Link href={clearHref} scroll={false} className="ml-1 text-[12.5px] font-medium text-brand-700 underline-offset-2 hover:underline">
        {d.clearFilters}
      </Link>
    </div>
  );
}

/** Page links with ellipses: 1 … 4 5 [6] 7 8 … 20 */
export function Pagination({ page, pages, hrefFor, lang }: { page: number; pages: number; hrefFor: (p: number) => string; lang: Lang }) {
  if (pages <= 1) return null;
  const d = dict(lang);
  const nums: (number | "…")[] = [];
  const add = (n: number) => nums[nums.length - 1] !== n && nums.push(n);
  add(1);
  if (page - 2 > 2) nums.push("…");
  for (let n = Math.max(2, page - 2); n <= Math.min(pages - 1, page + 2); n++) add(n);
  if (page + 2 < pages - 1) nums.push("…");
  add(pages);
  const btn = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium";
  return (
    <nav aria-label={d.pagination} className="portal-noprint flex flex-col items-center gap-2">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={cx(btn, "gap-1 text-ink-2 hover:bg-subtle hover:text-ink")} rel="prev">
              <Icon name="arrowLeft" size={15} /> {d.prev}
            </Link>
          ) : (
            <span className={cx(btn, "gap-1 text-muted/60")} aria-disabled="true">
              <Icon name="arrowLeft" size={15} /> {d.prev}
            </span>
          )}
        </li>
        {nums.map((n, i) =>
          n === "…" ? (
            <li key={`e${i}`} className="hidden px-1 text-muted sm:block" aria-hidden>
              …
            </li>
          ) : (
            <li key={n} className={cx(n !== page && Math.abs(n - page) > 1 && n !== 1 && n !== pages && "hidden sm:block")}>
              {n === page ? (
                <span aria-current="page" className={cx(btn, "num bg-brand-600 text-white")}>
                  {n}
                </span>
              ) : (
                <Link href={hrefFor(n)} aria-label={fmt(d.goToPage, { page: n })} className={cx(btn, "num text-ink-2 ring-1 ring-line ring-inset hover:bg-subtle hover:text-ink")}>
                  {n}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={hrefFor(page + 1)} className={cx(btn, "gap-1 text-ink-2 hover:bg-subtle hover:text-ink")} rel="next">
              {d.next} <Icon name="arrowRight" size={15} />
            </Link>
          ) : (
            <span className={cx(btn, "gap-1 text-muted/60")} aria-disabled="true">
              {d.next} <Icon name="arrowRight" size={15} />
            </span>
          )}
        </li>
      </ul>
      <p className="num text-[12.5px] text-muted">{fmt(d.pageOf, { page, pages })}</p>
    </nav>
  );
}

/** Text alternative to the map: every hospital with matching trials, with links (keyboard / screen-reader users). */
export function HospitalCountList({
  items,
  lang,
  listHref,
  hospitalHref,
  heading,
}: {
  items: HospitalAggregate[];
  lang: Lang;
  listHref: (id: string) => string;
  hospitalHref: (id: string) => string;
  heading: ReactNode;
}) {
  const d = dict(lang);
  return (
    <section aria-labelledby="hospital-list-title" className="mt-6">
      <h2 id="hospital-list-title" className="text-base font-semibold text-ink">
        {heading}
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((h) => (
          <li key={h.hospital.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span className="min-w-0">
              <Link href={hospitalHref(h.hospital.id)} className="block truncate text-[14px] font-medium text-ink hover:text-brand-700 hover:underline">
                {h.hospital.name}
              </Link>
              <span className="text-[12px] text-muted">{h.hospital.municipality}</span>
            </span>
            <Link href={listHref(h.hospital.id)} className="num shrink-0 rounded-full bg-subtle px-2.5 py-1 text-[12.5px] font-semibold text-ink-2 ring-1 ring-line ring-inset hover:bg-brand-50 hover:text-brand-800">
              {fmt(h.total === 1 ? d.resultsOne : d.resultsOther, { n: formatNumber(h.total, lang) })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
