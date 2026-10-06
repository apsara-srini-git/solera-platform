"use client";

import { useId, useRef, useState } from "react";
import { Icon, cx } from "@/components/ui";
import { MAX_SAVED_SEARCH_BYTES, downloadTextFile, parseSponsorSearchFile, sponsorSearchFile } from "@/lib/saved-search";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { TrialCriteria } from "@/lib/types";

/**
 * "Download search" / "Open saved search": the criteria as a small JSON file on the sponsor's own device, read back in
 * the browser. No account, nothing stored by Solera. Only blinded criteria go in the file (see sponsorSearchFile).
 */
export function SavedSearch({ criteria, onOpen, className }: { criteria: TrialCriteria; onOpen: (c: TrialCriteria) => void; className?: string }) {
  const t = SEARCH[useLang()].saved;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const canSave = !!criteria.indication.trim();

  const download = () => {
    setError(null);
    const f = sponsorSearchFile(criteria);
    downloadTextFile(f.filename, f.json);
    setSaved(true);
  };

  const open = async (file: File | undefined) => {
    setError(null);
    setSaved(false);
    if (!file) return;
    if (file.size > MAX_SAVED_SEARCH_BYTES) return setError(t.errors["too-large"]);
    const r = parseSponsorSearchFile(await file.text().catch(() => ""));
    if (!r.ok) return setError(t.errors[r.error]);
    onOpen(r.criteria);
  };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent";
  return (
    <div className={cx("text-[13px]", className)} data-testid="saved-search">
      <div className="-ml-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <button type="button" className={btn} onClick={download} disabled={!canSave} title={canSave ? undefined : t.enterFirst} data-testid="download-search">
          <Icon name="download" size={14} /> {t.download}
        </button>
        <button type="button" className={btn} onClick={() => input.current?.click()} data-testid="open-search">
          <Icon name="upload" size={14} /> {t.open}
        </button>
        <input
          ref={input}
          id={`${id}-file`}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.fileAria}
          data-testid="open-search-file"
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-0.5 text-[12.5px] text-muted" role={saved ? "status" : undefined}>
        {saved ? <span className="text-emerald-700">{t.savedToDownloads}</span> : null}
        {t.localNote}
      </p>
      {error && (
        <p className="mt-1.5 flex items-start gap-1.5 text-rose-700" role="alert" data-testid="saved-search-error">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
