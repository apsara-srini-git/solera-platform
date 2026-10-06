import { Badge, Card, Icon, PageHeader, type IconName } from "@/components/ui";
import { PAGES } from "@/lib/i18n/pro/pages";
import { getProLang } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: PAGES[await getProLang()].terms.metaTitle };
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-line-strong">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 sm:grid-cols-[2.25rem_1fr] sm:gap-4">
      <span className="hidden h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 sm:grid">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
      </div>
    </section>
  );
}

// DRAFT - placeholder wording to be replaced by text reviewed by a Spanish lawyer before launch.
export default async function Terms() {
  const t = PAGES[await getProLang()].terms;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={[{ label: "Solera", href: "/" }, { label: t.title }]}
        title={t.title}
        subtitle={t.subtitle}
        meta={<Badge tone="warning" dot>{t.draft}</Badge>}
      />
      <Card padding="lg" className="space-y-10">
        <Section icon="doc" title={t.uploadsTitle}>
          <Bullets items={t.uploads} />
        </Section>
        <Section icon="send" title={t.contactTitle}>
          {t.contact.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </Section>
        <Section icon="shield" title={t.reuseTitle}>
          <Bullets items={t.reuse} />
        </Section>
      </Card>
    </div>
  );
}
