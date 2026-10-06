import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLang, LANG_COOKIE, preferredFromAcceptLanguage, PRO_DEFAULT_LANG, type Lang } from "./pro";

export { preferredFromAcceptLanguage };

/**
 * UI language of the professional side (sponsors, CROs, investigators). Same "lang" cookie as the patient portal (set by
 * the ES | EN toggle via /pacientes/idioma), so a choice made on either side carries over. Without a cookie: Spanish
 * when the browser's Accept-Language prefers Spanish over English, otherwise English.
 */
export const getProLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(v)) return v;
  return preferredFromAcceptLanguage((await headers()).get("accept-language")) ?? PRO_DEFAULT_LANG;
});

/** Same rule for route handlers, from the request itself. */
export function langFromRequest(req: Request & { cookies?: { get(name: string): { value: string } | undefined } }): Lang {
  const c = req.cookies?.get(LANG_COOKIE)?.value ?? /(?:^|;\s*)lang=(es|en)\b/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (isLang(c)) return c;
  return preferredFromAcceptLanguage(req.headers.get("accept-language")) ?? PRO_DEFAULT_LANG;
}
