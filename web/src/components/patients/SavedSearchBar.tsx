"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui";
import {
  MAX_SAVED_SEARCH_BYTES,
  downloadTextFile,
  parsePatientSearchFile,
  patientSearchFile,
  patientSearchUrl,
  type PatientSavedQuery,
  type SavedSearchError,
} from "@/lib/saved-search";

export interface SavedSearchLabels {
  title: string;
  download: string;
  open: string;
  copy: string;
  copied: string;
  copyFailed: string;
  note: string;
  done: string;
  fileLabel: string;
  errorFile: string;
  errorKind: string;
  errorVersion: string;
}

/**
 * "Descargar búsqueda" / "Abrir búsqueda guardada" / "Copiar enlace": the search (words, filters, order, view) as a small
 * file on the visitor's device, or as the page link. Everything happens in the browser: no account, nothing stored by
 * Solera, no tracking. Opening a file just navigates to the portal URL it describes (the server re-checks every value).
 */
export function SavedSearchBar({ query, labels }: { query: PatientSavedQuery; labels: SavedSearchLabels }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const errorText = (e: SavedSearchError) =>
    e === "wrong-kind" ? labels.errorKind : e === "newer-version" ? labels.errorVersion : labels.errorFile;

  const download = () => {
    const f = patientSearchFile(query);
    downloadTextFile(f.filename, f.json);
    setStatus({ kind: "ok", text: labels.done });
  };

  const open = async (file: File | undefined) => {
    setStatus(null);
    if (!file) return;
    if (file.size > MAX_SAVED_SEARCH_BYTES) return setStatus({ kind: "error", text: labels.errorFile });
    const r = parsePatientSearchFile(await file.text().catch(() => ""));
    if (!r.ok) return setStatus({ kind: "error", text: errorText(r.error) });
    router.push(patientSearchUrl(r.query));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus({ kind: "ok", text: labels.copied });
    } catch {
      setStatus({ kind: "error", text: labels.copyFailed });
    }
  };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-brand-700 hover:bg-brand-50";
  return (
    <div className="portal-noprint text-[13px]" data-testid="patient-saved-search">
      <div className="-ml-2 flex flex-wrap items-center gap-x-1 gap-y-1">
        <span className="sr-only">{labels.title}</span>
        <button type="button" className={btn} onClick={download} data-testid="patient-download-search">
          <Icon name="download" size={14} /> {labels.download}
        </button>
        <button type="button" className={btn} onClick={() => input.current?.click()} data-testid="patient-open-search">
          <Icon name="upload" size={14} /> {labels.open}
        </button>
        <button type="button" className={btn} onClick={copy} data-testid="patient-copy-link">
          <Icon name="link" size={14} /> {labels.copy}
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label={labels.fileLabel}
          data-testid="patient-open-search-file"
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-0.5 text-[12.5px] text-muted">{labels.note}</p>
      {status && (
        <p
          className={status.kind === "ok" ? "mt-1 flex items-center gap-1.5 text-emerald-700" : "mt-1 flex items-start gap-1.5 text-rose-700"}
          role={status.kind === "ok" ? "status" : "alert"}
          data-testid="patient-saved-search-status"
        >
          <Icon name={status.kind === "ok" ? "check" : "alert"} size={14} className="mt-0.5 shrink-0" /> {status.text}
        </p>
      )}
    </div>
  );
}
