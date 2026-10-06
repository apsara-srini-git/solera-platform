import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dict } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";

// Unknown /pacientes/* addresses: render the portal's own not-found page inside the portal layout (instead of the
// framework's bare English 404 outside it).
export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLang());
  return { title: d.pageNotFoundTitle, robots: { index: false } };
}

export default async function PortalCatchAll(props: PageProps<"/pacientes/[...rest]">) {
  await props.params;
  notFound();
}
