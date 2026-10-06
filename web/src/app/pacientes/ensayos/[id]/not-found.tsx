import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { dict } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";

export default async function TrialNotFound() {
  const d = dict(await getLang());
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <EmptyState
        icon="search"
        title={<span role="heading" aria-level={1}>{d.notFoundTitle}</span>}
        description={d.notFoundText}
        action={
          <Link href="/pacientes" className="btn-primary">
            {d.backToSearch}
          </Link>
        }
      />
    </div>
  );
}
