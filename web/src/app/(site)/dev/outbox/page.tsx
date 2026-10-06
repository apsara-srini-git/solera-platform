import { notFound } from "next/navigation";
import { db } from "@/lib/db";

// Development only: shows every email Solera would have sent (and the delivery status). In production it is available
// only on password-protected previews that opt in (SITE_PASSWORD + ENABLE_OUTBOX=1), so the team can play the hospital.
export default async function Outbox() {
  const previewOutbox = !!process.env.SITE_PASSWORD && process.env.ENABLE_OUTBOX === "1";
  if (process.env.NODE_ENV === "production" && !previewOutbox) notFound();
  const emails = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dev outbox</h1>
      <p className="text-sm text-slate-600">Emails are logged here. Set RESEND_API_KEY in .env to actually deliver them.</p>
      {emails.map((e) => (
        <article key={e.id} className="card p-4">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span>To: <strong className="text-slate-800">{e.to}</strong> · {e.kind}</span>
            <span>{e.status} · {e.createdAt.toLocaleString("en-GB")}</span>
          </div>
          <h2 className="mt-1 font-medium">{e.subject}</h2>
          <pre className="mt-2 font-sans text-sm whitespace-pre-wrap text-slate-700">{linkify(e.body)}</pre>
        </article>
      ))}
      {!emails.length && <p className="text-sm text-slate-500">No emails yet.</p>}
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} href={part} className="text-teal-700 underline">{part}</a> : part,
  );
}
