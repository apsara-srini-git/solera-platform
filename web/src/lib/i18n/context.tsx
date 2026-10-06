"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "./pro";

// The professional side's UI language for client components. Set once by (site)/layout.tsx from the "lang" cookie;
// client components pick their own dictionary module with it: `const t = SEARCH[useLang()]`.

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}
