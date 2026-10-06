import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dataset } from "./data";
import type { SourceDates } from "@/components/ui/sources";

/**
 * "Refresh public data": runs `python3 pipeline/build_data.py --refresh` from the repo root as a detached background
 * process. State lives in files (no DB): storage/refresh/{lock, state.json, run.log, exit_code}.
 *
 * - Single flight: the lock file is created with O_EXCL ("wx"), so two requests can never both start a run.
 * - Global cooldown: 60 minutes from the start of the last successful run; 5 minutes after a failed one, so a retry is
 *   possible soon.
 * - Public status: a failure says only that nothing changed. The pipeline's last log line stays server-side (state.json
 *   `detail`, the server log and storage/refresh/run.log).
 * - Survives a dev-server restart: the run is a detached `sh -c` that writes its exit code to a file; status() reads it.
 * - Never half-written data: the pipeline writes each JSON to a temp file and renames it into place, and data.ts keeps
 *   serving the previous dataset until all files parse. A failed run leaves the old files untouched.
 */

export const COOLDOWN_MS = 60 * 60 * 1000;
/** After a failed run, a retry may start this long after it ended. */
export const FAILED_COOLDOWN_MS = 5 * 60 * 1000;
const STALE_MS = 3 * 60 * 60 * 1000; // a run older than this with no live process is treated as dead

const WEB_ROOT = process.cwd();
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const DIR = path.join(WEB_ROOT, "storage", "refresh");
const LOCK = path.join(DIR, "lock");
const STATE = path.join(DIR, "state.json");
const LOG = path.join(DIR, "run.log");
const EXIT = path.join(DIR, "exit_code");

export type RefreshStatus = "idle" | "running" | "succeeded" | "failed";

export interface DataSummary {
  trials: number;
  hospitals: number;
  builtAt: string | null;
}

export interface RefreshState {
  status: RefreshStatus;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  /** Progress text while running (from the pipeline's step lines). */
  progress?: string | null;
  /** The same step as a number for the UI's own wording: 0 starting, 1–4 pipeline steps, 5 writing the data files. */
  progressStep?: number | null;
  pid?: number | null;
  startedBy?: string | null;
  before?: DataSummary | null;
  after?: DataSummary | null;
  /** Server-side only: the pipeline's last log line after a failure (never sent to the browser). */
  detail?: string | null;
}

export interface RefreshInfo extends RefreshState {
  /** When the next refresh may start (cooldown), ISO; null when one can start now. */
  nextAvailableAt: string | null;
  /** The data the app is serving now. */
  data: DataSummary;
}

const IDLE: RefreshState = { status: "idle", startedAt: null, finishedAt: null, message: null };

const FAILED_MESSAGE = "The refresh did not finish, so nothing changed: Solera is still showing the previous public data.";

function readState(): RefreshState {
  try {
    return { ...IDLE, ...JSON.parse(fs.readFileSync(STATE, "utf8")) };
  } catch {
    return { ...IDLE };
  }
}

function writeState(s: RefreshState) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${STATE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
  fs.renameSync(tmp, STATE);
}

function alive(pid: number | null | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function currentData(): DataSummary {
  const r = dataset().report as { trials: number; hospitals: number; builtOn: string; builtAt?: string };
  return { trials: r.trials, hospitals: r.hospitals, builtAt: r.builtAt ?? (r.builtOn ? `${r.builtOn}T00:00:00Z` : null) };
}

/** Per-source fetch dates and links from build_report.json, for SourceChip popovers and the data-sources page. */
export function sourceDates(): SourceDates {
  const r = dataset().report as { sourceDetails?: SourceDates; builtOn?: string };
  return r.sourceDetails ?? {};
}

/** The step the pipeline is on, from the last step line in the log. */
const STEPS: [RegExp, string][] = [
  [/Loading hospital catalogue/, "Step 1 of 4 · Reading the national hospital catalogue"],
  [/Loading ClinicalTrials\.gov/, "Step 2 of 4 · Downloading ClinicalTrials.gov"],
  [/Loading REec/, "Step 3 of 4 · Downloading REec (AEMPS)"],
  [/Enriching hospitals/, "Step 4 of 4 · Updating maps, photos, SERMAS and ethics committees"],
  [/"builtOn"/, "Writing the new data files"],
];
function progressFromLog(): { progress: string | null; progressStep: number | null } {
  let text = "";
  try {
    const fd = fs.openSync(LOG, "r");
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    text = buf.toString("utf8");
  } catch {
    return { progress: null, progressStep: null };
  }
  let best: { at: number; label: string; step: number } | null = null;
  STEPS.forEach(([re, label], i) => {
    const all = [...text.matchAll(new RegExp(re.source, "g"))];
    const at = all.length ? all[all.length - 1].index! : -1;
    if (at >= 0 && (!best || at > best.at)) best = { at, label, step: i + 1 };
  });
  const b = best as { label: string; step: number } | null;
  return b ? { progress: b.label, progressStep: b.step } : { progress: "Starting…", progressStep: 0 };
}

function lastLogLine(): string {
  try {
    const lines = fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean);
    return (lines[lines.length - 1] ?? "").slice(0, 300);
  } catch {
    return "";
  }
}

/** Do the three data files parse? (The app keeps serving the old ones until they do.) */
function dataFilesParse(): boolean {
  try {
    for (const f of ["sites.json", "trials.json", "build_report.json"]) JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data", f), "utf8"));
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK);
  } catch {}
}

/** Reads the state and, when a run has ended (exit code written, or process gone), records the outcome. */
export function refreshStatus(): RefreshInfo {
  let s = readState();
  if (s.status === "running") {
    let code: number | null = null;
    try {
      code = Number(fs.readFileSync(EXIT, "utf8").trim());
    } catch {}
    const started = s.startedAt ? Date.parse(s.startedAt) : 0;
    const gone = !alive(s.pid);
    if (code !== null && Number.isFinite(code)) {
      const ok = code === 0 && dataFilesParse();
      const after = ok ? readReport() : null;
      s = {
        ...s,
        status: ok ? "succeeded" : "failed",
        finishedAt: new Date().toISOString(),
        progress: null,
        progressStep: null,
        after,
        message: ok ? summarise(s.before ?? null, after) : FAILED_MESSAGE,
        detail: ok ? null : lastLogLine() || null,
      };
      if (!ok) console.error(`[refresh] pipeline exited with code ${code}: ${s.detail ?? "(no log output)"}`);
      writeState(s);
      releaseLock();
    } else if (gone || Date.now() - started > STALE_MS) {
      s = {
        ...s,
        status: "failed",
        finishedAt: new Date().toISOString(),
        progress: null,
        progressStep: null,
        message: "The refresh stopped before finishing, so nothing changed: Solera is still showing the previous public data.",
      };
      writeState(s);
      releaseLock();
    } else {
      s = { ...s, ...progressFromLog() };
    }
  }
  // 60 minutes after a successful start; a failed run only blocks a retry for a few minutes after it ended
  const failed = s.status === "failed";
  const from = failed ? Date.parse(s.finishedAt ?? s.startedAt ?? "") || 0 : s.startedAt ? Date.parse(s.startedAt) : 0;
  const wait = failed ? FAILED_COOLDOWN_MS : COOLDOWN_MS;
  const next = from && Date.now() - from < wait ? new Date(from + wait).toISOString() : null;
  const { pid: _pid, startedBy: _by, detail: _detail, ...pub } = s;
  void _pid;
  void _by;
  void _detail;
  // public: a failure never carries pipeline output (older state files may still hold "Last message: …")
  if (failed && pub.message?.includes("Last message:")) pub.message = FAILED_MESSAGE;
  return { ...pub, nextAvailableAt: s.status === "running" ? null : next, data: currentData() };
}

function readReport(): DataSummary | null {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, "data", "build_report.json"), "utf8"));
    return { trials: r.trials, hospitals: r.hospitals, builtAt: r.builtAt ?? null };
  } catch {
    return null;
  }
}

function summarise(before: DataSummary | null, after: DataSummary | null): string {
  if (!after) return "Public data refreshed.";
  if (!before) return `Public data refreshed: ${after.trials.toLocaleString("en")} trials.`;
  const d = after.trials - before.trials;
  return d === 0
    ? `Public data refreshed. Trials: ${after.trials.toLocaleString("en")} (no change).`
    : `Public data refreshed. Trials: ${before.trials.toLocaleString("en")} → ${after.trials.toLocaleString("en")} (${d > 0 ? "+" : ""}${d.toLocaleString("en")}).`;
}

export type StartResult =
  | { ok: true; info: RefreshInfo }
  | { ok: false; reason: "running" | "cooldown"; info: RefreshInfo };

/** Starts a refresh unless one is running or the cooldown has not passed. */
export function startRefresh(userId: string): StartResult {
  const info = refreshStatus(); // also finalises a finished run and frees its lock
  if (info.status === "running") return { ok: false, reason: "running", info };
  if (info.nextAvailableAt) return { ok: false, reason: "cooldown", info };
  fs.mkdirSync(DIR, { recursive: true });
  let fd: number;
  try {
    fd = fs.openSync(LOCK, "wx"); // atomic: only one caller can create it
  } catch {
    // a lock with no running state behind it (e.g. a crash between creating it and writing the state) is stale
    // after a minute; a fresh one belongs to a request that is starting a run right now
    try {
      if (readState().status !== "running" && Date.now() - fs.statSync(LOCK).mtimeMs > 60_000) releaseLock();
    } catch {}
    return { ok: false, reason: "running", info: refreshStatus() };
  }
  try {
    try {
      fs.unlinkSync(EXIT);
    } catch {}
    const startedAt = new Date().toISOString();
    const python = process.env.SOLERA_PYTHON || "python3";
    // the shell records the exit code so the outcome is known even if this server restarts meanwhile
    const script = `"${python}" pipeline/build_data.py --refresh > "${LOG}" 2>&1; echo $? > "${EXIT}.tmp" && mv "${EXIT}.tmp" "${EXIT}"`;
    const child = spawn("/bin/sh", ["-c", script], { cwd: REPO_ROOT, detached: true, stdio: "ignore", env: process.env });
    child.unref();
    fs.writeSync(fd, JSON.stringify({ pid: child.pid, startedAt }));
    writeState({
      status: "running",
      startedAt,
      finishedAt: null,
      message: null,
      progress: "Starting…",
      progressStep: 0,
      pid: child.pid ?? null,
      startedBy: userId,
      before: currentData(),
      after: null,
    });
  } catch (e) {
    releaseLock();
    throw e;
  } finally {
    fs.closeSync(fd);
  }
  return { ok: true, info: refreshStatus() };
}
