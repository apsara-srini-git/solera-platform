import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { dict } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";

/** Any unknown /pacientes/* address (via [...rest]) and notFound() calls without a closer not-found file. */
export default async function PortalNotFound() {
  const d = dict(await getLang());
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <EmptyState
        icon="search"
        title={<span role="heading" aria-level={1}>{d.pageNotFoundTitle}</span>}
        description={d.pageNotFoundText}
        action={
          <Link href="/pacientes" className="btn-primary">
            {d.backToSearch}
          </Link>
        }
      />
    </div>
  );
}
