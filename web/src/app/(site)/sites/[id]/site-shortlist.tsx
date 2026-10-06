"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui";
import { ShortlistButton } from "@/components/search/ResultCard";
import { useLang } from "@/lib/i18n/context";
import { SITE_SHORTLIST } from "@/lib/i18n/pro/site";
import type { TrialCriteria } from "@/lib/types";
import { toggleShortlist } from "../../actions";

/** Shortlist / remove this hospital for the search the user came from (?c=), in the same project as the results page. */
export function SiteShortlist({
  siteId,
  criteria,
  projectId: initialProjectId,
  shortlisted: initialShortlisted,
  count: initialCount,
}: {
  siteId: string;
  criteria: TrialCriteria;
  projectId: string | null;
  shortlisted: boolean;
  count: number;
}) {
  const router = useRouter();
  const t = SITE_SHORTLIST[useLang()];
  const [projectId, setProjectId] = useState(initialProjectId);
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const r = await toggleShortlist(projectId, criteria, siteId);
      setShortlisted(r.siteIds.includes(siteId));
      setCount(r.siteIds.length);
      if (r.projectId !== projectId) {
        setProjectId(r.projectId);
        // keep the project in the URL so "Search results" and a reload stay in the same project
        const url = new URL(window.location.href);
        url.searchParams.set("project", r.projectId);
        router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <ShortlistButton shortlisted={shortlisted} busy={busy} onClick={toggle} />
      {error ? (
        <span className="text-xs text-rose-700" role="alert">
          {t.error}
        </span>
      ) : (
        projectId &&
        count > 0 && (
          <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            <span className="num">{count}</span> {t.shortlisted} · {t.continue} <Icon name="arrowRight" size={12} />
          </Link>
        )
      )}
    </div>
  );
}
