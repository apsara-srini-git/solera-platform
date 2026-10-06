import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isLang } from "@/lib/patients/i18n";

// ES | EN toggle for the patient portal AND the professional side (sponsor header): sets the technical "lang" cookie
// and sends the visitor back to the page they were on (any same-site path). Nothing is logged or stored on the server.

function safeNext(raw: unknown, req: NextRequest): string {
  const ok = (p: string) => p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") && !p.startsWith("/pacientes/idioma");
  if (typeof raw === "string" && ok(raw)) return raw;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === req.nextUrl.origin && ok(u.pathname)) return u.pathname + u.search;
    } catch {
      /* ignore */
    }
  }
  return "/pacientes";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const lang = form.get("lang");
  const res = NextResponse.redirect(new URL(safeNext(form.get("next"), req), req.url), 303);
  if (isLang(lang)) {
    res.cookies.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  }
  return res;
}

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/pacientes", req.url), 303);
}
