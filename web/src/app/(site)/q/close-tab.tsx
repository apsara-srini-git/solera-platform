"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

/**
 * The records page opens in a new tab from the questionnaire, so "back" would open a second, empty copy of the form.
 * This closes the tab instead; the questionnaire, with the hospital's unsaved answers, is still open in the other tab.
 * Browsers only let a page close a tab it was opened into: if closing is refused, it says so.
 */
export function CloseTab() {
  const [blocked, setBlocked] = useState(false);
  return blocked ? (
    <p className="text-[13px] text-ink-2" role="status" data-testid="close-tab-fallback">
      Cierre esta pestaña para volver: el cuestionario y sus respuestas siguen abiertos en la pestaña anterior.
      <span className="block text-xs text-muted">Close this tab to go back: the questionnaire and your answers are still open in the previous tab.</span>
    </p>
  ) : (
    <button
      type="button"
      data-testid="close-tab"
      onClick={() => {
        window.close();
        // still here a moment later: the browser refused (e.g. the page was opened directly, not from the form)
        window.setTimeout(() => setBlocked(true), 300);
      }}
      className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
    >
      <Icon name="x" size={13} /> Cerrar esta pestaña y volver al cuestionario
    </button>
  );
}
