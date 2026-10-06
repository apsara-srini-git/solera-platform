"use client";

import { useEffect } from "react";

const FOCUS_KEY = "patient-portal-focus";

/** Submits the GET search form as soon as a filter changes (selects / checkboxes, including controls attached with the
 *  `form` attribute). The visible "Apply" button stays for no-JS use and is hidden once this runs.
 *  - Back/forward: the browser must not restore an old filter value the page is not showing results for, so the form
 *    controls are reset to the server-rendered values (also autoComplete="off" on the controls).
 *  - Focus: after the reload, focus returns to the control that was changed (its id is kept in sessionStorage for one
 *    navigation only; nothing about the search itself is stored). */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    document.querySelectorAll<HTMLElement>(`[data-apply][form="${formId}"], #${formId} [data-apply]`).forEach((el) => (el.style.display = "none"));

    const controls = () =>
      [...form.elements].filter((el): el is HTMLInputElement | HTMLSelectElement => el instanceof HTMLSelectElement || el instanceof HTMLInputElement);
    const resetToServer = () => {
      for (const el of controls()) {
        if (el instanceof HTMLSelectElement) {
          const def = [...el.options].find((o) => o.defaultSelected);
          el.value = def ? def.value : (el.options[0]?.value ?? "");
        } else if (el.type === "checkbox") el.checked = el.defaultChecked;
        else if (el.type === "search" || el.type === "text") el.value = el.defaultValue;
      }
    };
    resetToServer();
    const onPageShow = () => resetToServer();
    window.addEventListener("pageshow", onPageShow);

    try {
      const id = sessionStorage.getItem(FOCUS_KEY);
      if (id) {
        sessionStorage.removeItem(FOCUS_KEY);
        const el = document.getElementById(id);
        // phones: the filters sit in a collapsed <details>; open it so the control can take focus again
        const box = el?.closest("details");
        if (box && !box.open) box.open = true;
        el?.focus();
      }
    } catch {
      /* storage blocked: focus simply stays at the top */
    }

    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement | null;
      if (!el || el.form !== form || el.type === "search" || el.type === "text") return;
      try {
        if (el.id) sessionStorage.setItem(FOCUS_KEY, el.id);
      } catch {
        /* ignore */
      }
      form.requestSubmit();
    };
    // keep shared URLs short: drop empty fields and the default sort before the GET navigation
    const onFormData = (e: FormDataEvent) => {
      for (const [k, v] of [...e.formData.entries()]) {
        if (v === "" || (k === "sort" && v === "updated")) e.formData.delete(k);
      }
    };
    document.addEventListener("change", onChange);
    form.addEventListener("formdata", onFormData);
    return () => {
      document.removeEventListener("change", onChange);
      form.removeEventListener("formdata", onFormData);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [formId]);
  return null;
}
