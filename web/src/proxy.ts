import { NextResponse, type NextRequest } from "next/server";
import { SECTION_HEADER, sectionOf } from "@/lib/section";

// Optional whole-site password for preview deployments (e.g. sharing a tunnel with the team before launch).
// Off unless SITE_PASSWORD is set. Any username works; only the password is checked.
const PASSWORD = process.env.SITE_PASSWORD;

function allowed(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (!PASSWORD || pass.length !== PASSWORD.length) return false;
    let diff = 0;
    for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ PASSWORD.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

function next(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(SECTION_HEADER, sectionOf(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  if (!PASSWORD) return next(request);
  if (allowed(request.headers.get("authorization"))) {
    const res = next(request);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  return new NextResponse("Solera preview. Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Solera preview", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
