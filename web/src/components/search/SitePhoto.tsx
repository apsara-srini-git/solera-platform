"use client";

/* eslint-disable @next/next/no-img-element -- Wikimedia Commons images; no remote image config needed for plain <img> */
import { useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n/context";
import { SEARCH } from "@/lib/i18n/pro/search";
import type { SiteImage } from "@/lib/types";

const SKIP = new Set([
  "hospital", "hospitales", "universitario", "universitaria", "general", "clinico", "clínico", "clinica", "clínica",
  "centro", "de", "del", "la", "el", "los", "las", "y", "san", "santa", "nuestra", "señora", "senora", "complejo", "fundacion",
  "fundación", "madrid", "hm", "the",
]);

/** Letters-only initials ("Hospital Universitario La Paz" → "PA"). Numbers are skipped so "12 de Octubre" never reads as a count. */
export function hospitalInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return (name.replace(/[^\p{L}]/gu, "").slice(0, 2) || "H").toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Small square stand-in used next to the name when there is no photo (e.g. result cards on phones). */
export function SiteAvatar({ className = "", children }: { className?: string; children?: ReactNode }) {
  const t = SEARCH[useLang()].photo;
  return (
    <div className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 ${className}`}>
      <BuildingGlyph className="h-6 w-6" />
      <span className="sr-only">{t.noPhoto}</span>
      {children}
    </div>
  );
}

function BuildingGlyph({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0-10h2a2 2 0 0 1 2 2v8M2 21h20M8 7h4M8 11h4M8 15h4" />
    </svg>
  );
}

/** Photo credit (author + licence, linked to the Commons file page). Required wherever a photo is shown. */
export function PhotoCredit({ image, className = "" }: { image: SiteImage; className?: string }) {
  const t = SEARCH[useLang()].photo;
  return (
    <span className={`text-[10.5px] leading-4 ${className}`}>
      {t.photo}{" "}
      <a href={image.sourcePage} target="_blank" rel="noopener noreferrer" className="text-inherit! underline decoration-current/40 underline-offset-2 hover:decoration-current">
        {image.author || "Wikimedia Commons"}
      </a>
      {" · "}
      {image.licenseUrl ? (
        <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" className="text-inherit! underline decoration-current/40 underline-offset-2 hover:decoration-current">
          {image.license}
        </a>
      ) : (
        image.license
      )}
      {" · Wikimedia Commons"}
    </span>
  );
}

/**
 * Hospital photo or an initials placeholder. `credit`:
 * - "hover": overlay that appears on hover / keyboard focus (always shown on touch screens)
 * - "caption": always-visible line under the image
 * - "overlay": always-visible overlay at the bottom
 */
export function SitePhoto({
  name,
  image,
  size = "thumb",
  credit = "hover",
  className = "",
  municipality,
  children,
}: {
  name: string;
  /** Shown on the no-photo placeholder. */
  municipality?: string;
  image: SiteImage | null;
  size?: "thumb" | "full";
  credit?: "hover" | "caption" | "overlay";
  className?: string;
  children?: ReactNode;
}) {
  const t = SEARCH[useLang()].photo;
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br from-brand-50 via-brand-100/70 to-[#e3efee] ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-surface/80 text-brand-700 shadow-xs ring-1 ring-brand-200/70">
            <BuildingGlyph className="h-[22px] w-[22px]" />
          </span>
          {municipality && <span className="max-w-full truncate text-[13px] font-medium text-ink-2">{municipality}</span>}
          <span className="text-[11.5px] text-muted">{t.noPhotoYet}</span>
        </div>
        {children}
      </div>
    );
  }
  const src = size === "full" ? image.url : image.thumbUrl || image.url;
  const img = (
    <img
      src={src}
      alt={t.alt(name)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition duration-500 ease-out-soft group-hover/photo:scale-[1.03]"
    />
  );
  if (credit === "caption") {
    return (
      <figure className={className}>
        <div className="group/photo relative h-full overflow-hidden rounded-[inherit]">
          {img}
          {children}
        </div>
        <figcaption className="mt-1.5 text-muted">
          <PhotoCredit image={image} />
        </figcaption>
      </figure>
    );
  }
  return (
    <div className={`group/photo relative overflow-hidden bg-subtle ${className}`}>
      {img}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pt-5 pb-1.5 text-white/95 transition duration-200 ${
          credit === "hover" ? "opacity-0 group-hover/photo:opacity-100 group-focus-within/photo:opacity-100 pointer-coarse:opacity-100" : ""
        }`}
      >
        <PhotoCredit image={image} className="line-clamp-2" />
      </div>
      {children}
    </div>
  );
}
