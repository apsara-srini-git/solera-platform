import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { COMMON } from "@/lib/i18n/pro";
import { getProLang } from "@/lib/i18n/server";
import { getLang as getPatientLang } from "@/lib/patients/lang";
import { SECTION_HEADER } from "@/lib/section";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Default title for pages outside the section layouts (e.g. the 404 for unmatched URLs), in the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const t = COMMON[await getProLang()];
  return { title: t.metaTitle, description: t.metaDescription };
}

export const viewport: Viewport = { themeColor: "#ffffff" };

/** Bare document shell. The sponsor/hospital app chrome lives in (site)/layout.tsx and the patient portal's in
 *  pacientes/layout.tsx, so neither ships the other's navigation. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Section comes from proxy.ts: hospital pages (/q, /optout) are Spanish-first, the patient portal has its own default.
  const section = (await headers()).get(SECTION_HEADER);
  const lang = section === "hospital" ? "es" : section === "patients" ? await getPatientLang() : await getProLang();
  return (
    <html lang={lang} className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-[15px]">{children}</body>
    </html>
  );
}
