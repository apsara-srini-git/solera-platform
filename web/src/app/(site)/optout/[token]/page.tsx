import { notFound } from "next/navigation";
import { Button, Card, Icon } from "@/components/ui";
import { db } from "@/lib/db";
import { optOut } from "../../actions";

export const metadata = { title: { absolute: "Darse de baja · Solera" }, robots: { index: false } };

export default async function OptOutPage({ params, searchParams }: PageProps<"/optout/[token]">) {
  const { token } = await params;
  const { done } = await searchParams;
  const inv = await db.invitation.findUnique({ where: { token } });
  if (!inv) notFound();
  return (
    <Card padding="lg" className="mx-auto max-w-md text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
        <Icon name={done ? "check" : "inbox"} size={20} />
      </div>
      {done ? (
        <>
          <p className="mt-4 font-semibold text-ink">Se ha dado de baja correctamente.</p>
          <p className="mt-1 text-sm text-muted">{inv.recipientEmail} no recibirá más correos de Solera. / will not receive further emails from Solera.</p>
        </>
      ) : (
        <form action={optOut.bind(null, token)} className="mt-4 space-y-3">
          <p className="font-semibold text-ink">¿Dejar de recibir correos de Solera?</p>
          <p className="text-sm text-muted">Se dejarán de enviar todos los correos de Solera a {inv.recipientEmail}. / Stop all Solera emails to this address.</p>
          <Button block>Darse de baja / Unsubscribe</Button>
        </form>
      )}
    </Card>
  );
}
