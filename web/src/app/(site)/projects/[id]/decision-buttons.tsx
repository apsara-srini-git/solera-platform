"use client";

import { useState, useTransition } from "react";
import { Button, Modal } from "@/components/ui";
import { COMMON } from "@/lib/i18n/pro";
import { useLang } from "@/lib/i18n/context";
import { PROJECTS } from "@/lib/i18n/pro/projects";
import { decide } from "../../actions";

/** Approve / reject with a confirmation, because both email the hospital and cannot be undone. */
export default function DecisionButtons({ itemId, siteName, declined }: { itemId: string; siteName: string; declined: boolean }) {
  const lang = useLang();
  const t = PROJECTS[lang].decision;
  const [ask, setAsk] = useState<"approved" | "rejected" | null>(null);
  const [pending, start] = useTransition();
  const confirm = () =>
    start(async () => {
      await decide(itemId, ask!);
      setAsk(null);
    });
  return (
    <div className="flex gap-2">
      {!declined && <Button size="sm" icon="check" onClick={() => setAsk("approved")}>{t.approve}</Button>}
      <Button size="sm" variant="secondary" onClick={() => setAsk("rejected")}>{declined ? t.close : t.reject}</Button>
      <Modal
        open={!!ask}
        onClose={() => setAsk(null)}
        size="sm"
        title={ask === "approved" ? t.approveTitle(siteName) : declined ? t.closeTitle(siteName) : t.rejectTitle(siteName)}
        description={
          ask === "approved"
            ? t.approveDescription
            : t.rejectDescription
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>{COMMON[lang].cancel}</Button>
            <Button variant={ask === "approved" ? "primary" : "danger"} loading={pending} onClick={confirm}>
              {ask === "approved" ? t.approveConfirm : t.rejectConfirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
