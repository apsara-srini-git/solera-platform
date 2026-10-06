"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Spinner, cx, fmtDay } from "@/components/ui";
import { useLang } from "@/lib/i18n/context";
import { SEARCH, madridTime, relativeTimeLang } from "@/lib/i18n/pro/search";
import type { RefreshInfo } from "@/lib/refresh";

const POLL_MS = 3000;

/**
 * "Updated <relative date> · Refresh". Starts a background refresh of the public data (POST /api/refresh), polls its
 * status while it runs, and on success reloads the page data and shows a toast with what changed. On failure the old
 * data stays and a calm note says so.
 */
export function RefreshControl({
  initial,
  loggedIn,
  onRefreshed,
  className,
  align = "start",
}: {
  initial: RefreshInfo;
  loggedIn: boolean;
  /** Called after a successful refresh (default: re-render the server page). */
  onRefreshed?: () => void;
  className?: string;
  align?: "start" | "end";
}) {
  const lang = useLang();
  const t = SEARCH[lang].refresh;
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<RefreshInfo>(initial);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [, tick] = useState(0);
  const sawRunning = useRef(initial.status === "running");

  // keep "2 min ago" fresh
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/refresh", { cache: "no-store" });
      if (!r.ok) return;
      const next: RefreshInfo = await r.json();
      setInfo(next);
      if (next.status === "running") sawRunning.current = true;
      else if (sawRunning.current) {
        sawRunning.current = false;
        if (next.status === "succeeded") {
          setToast(t.done(next.before, next.after));
          if (onRefreshed) onRefreshed();
          router.refresh();
        }
      }
    } catch {}
  }, [onRefreshed, router, t]);

  useEffect(() => {
    if (info.status !== "running") return;
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [info.status, poll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(t);
  }, [toast]);

  const start = async () => {
    setPosting(true);
    setError(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (body && typeof body.status === "string") setInfo(body as RefreshInfo);
      if (r.status === 202 || body.status === "running") sawRunning.current = true;
      else if (!r.ok) setError(body.error ?? t.startError);
    } catch {
      setError(t.connError);
    } finally {
      setPosting(false);
    }
  };

  const running = info.status === "running";
  const updated = info.data.builtAt;
  const cooldown = !running && info.nextAvailableAt ? info.nextAvailableAt : null;

  return (
    <div className={cx("text-xs text-muted", className)}>
      <div className={cx("flex flex-wrap items-center gap-x-1.5 gap-y-1", align === "end" && "justify-end")}>
        <Icon name="database" size={13} className="shrink-0" />
        <span title={updated ? t.builtTitle(fmtDay(updated, { time: true, lang })) : undefined}>
          {t.updated} <span className="text-ink-2">{updated ? relativeTimeLang(updated, lang) : "-"}</span>
        </span>
        <span aria-hidden>·</span>
        {running ? (
          <span className="inline-flex items-center gap-1.5 text-ink-2">
            <Spinner size={12} className="text-brand-600" />
            {t.refreshing}
          </span>
        ) : !loggedIn ? (
          <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className="font-medium text-brand-700 hover:underline">
            {t.logInToRefresh}
          </Link>
        ) : cooldown ? (
          <span>{t.nextAt(madridTime(cooldown, lang))}</span>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={posting}
            className="inline-flex items-center gap-1 rounded font-medium text-brand-700 hover:underline disabled:opacity-60"
          >
            {posting ? <Spinner size={12} /> : <Icon name="refresh" size={12} />}
            {t.refresh}
          </button>
        )}
      </div>
      <div aria-live="polite" className="empty:hidden">
        {running && (
          <p className="mt-1 text-[11.5px] text-ink-2">
            {t.running(info.progressStep != null ? (t.steps[info.progressStep] ?? t.starting) : (info.progress ?? t.starting))}
          </p>
        )}
        {!running && info.status === "failed" && !toast && (
          <p className="mt-1 flex items-start gap-1 text-[11.5px] text-amber-800">
            <Icon name="info" size={12} className="mt-0.5 shrink-0" />
            <span>{t.failed(info.finishedAt ? fmtDay(info.finishedAt, { time: true, lang }) : "")}</span>
          </p>
        )}
        {error && <p className="mt-1 text-[11.5px] text-amber-800">{error}</p>}
      </div>
      {toast && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-[1300] flex max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink shadow-pop max-sm:right-3 max-sm:left-3 max-sm:bottom-[calc(84px+env(safe-area-inset-bottom))]"
        >
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <Icon name="check" size={12} strokeWidth={2.5} />
          </span>
          <span className="min-w-0 flex-1">{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t.dismiss} className="-mt-0.5 -mr-1 grid h-6 w-6 place-items-center rounded text-muted hover:bg-subtle">
            <Icon name="x" size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
