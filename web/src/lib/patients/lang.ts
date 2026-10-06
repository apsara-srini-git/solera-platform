import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, isLang } from "./i18n";
import type { Lang } from "./types";

/** UI language from the "lang" cookie (set by /pacientes/idioma). Spanish by default. Nothing else is read or stored. */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "es";
}
