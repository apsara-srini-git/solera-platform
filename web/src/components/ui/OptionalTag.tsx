"use client";

import { useLang } from "@/lib/i18n/context";
import { UI } from "@/lib/i18n/pro/ui";

/** Default "(optional)" text of <Label optional>, in the page's UI language (client leaf so Field stays server-safe). */
export function OptionalTag() {
  return <>{UI[useLang()].optional}</>;
}
