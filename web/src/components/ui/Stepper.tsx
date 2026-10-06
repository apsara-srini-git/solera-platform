"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/pro";
import { UI } from "@/lib/i18n/pro/ui";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface Step {
  key: string;
  label: ReactNode;
  /** Short line under the label (hidden on phones), e.g. "12 sites". */
  hint?: ReactNode;
  href?: string;
}

const WORKFLOW_KEYS = ["shortlist", "questionnaire", "send", "responses", "decision"] as const;

/** The sponsor workflow, in order, with labels in `lang`. */
export function workflowSteps(lang: Lang): Step[] {
  return WORKFLOW_KEYS.map((key) => ({ key, label: UI[lang].steps[key] }));
}

/** The sponsor workflow, in order (English labels; Stepper shows them in the page language). */
export const WORKFLOW_STEPS: Step[] = workflowSteps("en");

export interface StepperProps {
  /** Key of the current step. Steps before it render as complete. */
  current: string;
  steps?: Step[];
  /** Override completion explicitly (e.g. a later step done before an earlier one). */
  completed?: string[];
  className?: string;
}

/**
 * Horizontal progress through the workflow. Steps with href become links.
 * <Stepper current="send" steps={WORKFLOW_STEPS.map(s => ({ ...s, href: `/projects/${id}#${s.key}` }))} />
 */
export function Stepper({ current, steps: stepsProp = WORKFLOW_STEPS, completed, className }: StepperProps) {
  const ui = UI[useLang()];
  // the default English workflow labels (WORKFLOW_STEPS, also when spread into custom steps) follow the page language
  const steps = stepsProp.map((s) => (typeof s.label === "string" && s.label === UI.en.steps[s.key] ? { ...s, label: ui.steps[s.key] } : s));
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));
  return (
    <nav aria-label={ui.progress} className={cx("w-full", className)}>
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const done = completed ? completed.includes(s.key) : i < idx;
          const isCurrent = i === idx;
          const state = isCurrent ? "current" : done ? "done" : "upcoming";
          const content = (
            <>
              <span
                className={cx(
                  "num relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
                  state === "done" && "bg-brand-600 text-white",
                  state === "current" && "bg-surface text-brand-700 ring-2 ring-brand-600 shadow-[0_0_0_4px_var(--color-brand-100)]",
                  state === "upcoming" && "bg-surface text-muted ring-1 ring-line-strong",
                )}
              >
                {state === "done" ? <Icon name="check" size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className="mt-2 hidden flex-col items-center text-center sm:flex">
                <span className={cx("text-[13px] font-medium", state === "upcoming" ? "text-muted" : "text-ink")}>{s.label}</span>
                {s.hint && <span className="mt-0.5 text-xs text-muted">{s.hint}</span>}
              </span>
              <span className="sr-only">{state === "done" ? ui.completed : state === "current" ? ui.currentStep : ""}</span>
            </>
          );
          return (
            <li key={s.key} className="relative flex flex-1 flex-col items-center" aria-current={isCurrent ? "step" : undefined}>
              {i > 0 && (
                <span aria-hidden className={cx("absolute top-3.5 right-1/2 left-[-50%] h-0.5 -translate-y-1/2", i <= idx || done ? "bg-brand-600" : "bg-line")} />
              )}
              {s.href ? (
                <Link href={s.href} className="group flex flex-col items-center rounded-lg px-1 hover:[&>span:first-child]:ring-brand-500">{content}</Link>
              ) : (
                <div className="flex flex-col items-center px-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {/* Phone: current step label under the dots */}
      <p className="mt-2 text-center text-[13px] font-medium text-ink sm:hidden">
        {ui.stepOf(idx + 1, steps.length)}: {steps[idx]?.label}
      </p>
    </nav>
  );
}
