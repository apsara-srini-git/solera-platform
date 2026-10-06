import { currentUser } from "@/lib/auth";
import { refreshStatus, startRefresh } from "@/lib/refresh";
import { SEARCH, madridTime } from "@/lib/i18n/pro/search";
import { langFromRequest } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Refresh status: idle / running / succeeded / failed, with timestamps, progress and the cooldown. Public: a failure
 *  returns only a generic message; the pipeline's own output stays in the server log and storage/refresh. */
export async function GET() {
  return Response.json(refreshStatus(), { headers: { "Cache-Control": "no-store" } });
}

/** Starts a background refresh of the public data. Logged-in users only; one at a time; once an hour (5 minutes after
 *  a failed run). */
export async function POST(request: Request) {
  const lang = langFromRequest(request);
  const m = SEARCH[lang].api.refresh;
  // same-origin only (the button posts from this site)
  const origin = request.headers.get("origin");
  // behind a reverse proxy / tunnel the public host arrives in x-forwarded-host
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && new URL(origin).host !== host) {
    return Response.json({ error: m.crossSite }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return Response.json({ error: m.logIn }, { status: 401 });
  const r = startRefresh(user.id);
  if (!r.ok) {
    const error =
      r.reason === "running"
        ? m.running
        : r.info.status === "failed"
          ? m.failedRetry(madridTime(r.info.nextAvailableAt!, lang))
          : m.cooldown(madridTime(r.info.nextAvailableAt!, lang));
    return Response.json({ error, ...r.info }, { status: r.reason === "running" ? 409 : 429 });
  }
  return Response.json(r.info, { status: 202 });
}
