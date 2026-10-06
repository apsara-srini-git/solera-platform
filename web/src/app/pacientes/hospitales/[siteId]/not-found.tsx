import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { dict } from "@/lib/patients/i18n";
import { getLang } from "@/lib/patients/lang";

export default async function HospitalNotFound() {
  const d = dict(await getLang());
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <EmptyState
        icon="search"
        title={<span role="heading" aria-level={1}>{d.hospitalNotFoundTitle}</span>}
        description={d.hospitalNotFoundText}
        action={
          <span className="flex flex-wrap justify-center gap-2">
            <Link href="/pacientes" className="btn-primary">
              {d.backToSearch}
            </Link>
            <Link href="/pacientes?view=map" className="btn-secondary">
              {d.seeHospitalMap}
            </Link>
          </span>
        }
      />
    </div>
  );
}
