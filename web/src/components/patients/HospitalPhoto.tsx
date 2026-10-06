"use client";

/* eslint-disable @next/next/no-img-element -- Wikimedia Commons images, shown with their attribution */
import { useState } from "react";
import { cx } from "@/components/ui";
import type { PatientHospital } from "@/lib/patients/types";

export interface HospitalPhotoLabels {
  credit: string; // "Foto"
  alt: string; // "Edificio de {name}" already filled
  noPhoto: string;
}

/** Commons credit: author + licence, linked to the file page. Required wherever the photo appears. */
export function PhotoCredit({ image, label, className }: { image: NonNullable<PatientHospital["image"]>; label: string; className?: string }) {
  return (
    <span className={cx("text-[10.5px] leading-4", className)}>
      {label}:{" "}
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

/** Hospital building photo with its credit overlaid, or a calm building placeholder. */
export function HospitalPhoto({
  image,
  labels,
  size = "thumb",
  credit = "overlay",
  className,
}: {
  image: PatientHospital["image"];
  labels: HospitalPhotoLabels;
  size?: "thumb" | "full";
  credit?: "overlay" | "caption" | "none";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) {
    return (
      <div className={cx("relative grid place-items-center overflow-hidden bg-gradient-to-br from-brand-50 to-[#e6efee] text-brand-700", className)}>
        <span className="flex flex-col items-center gap-1">
          <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0-10h2a2 2 0 0 1 2 2v8M2 21h20M8 7h4M8 11h4M8 15h4" />
          </svg>
          <span className="text-[11.5px] text-muted">{labels.noPhoto}</span>
        </span>
      </div>
    );
  }
  const img = (
    <img
      src={size === "full" ? image.url : image.thumbUrl || image.url}
      alt={labels.alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
  if (credit === "caption") {
    return (
      <figure className={className}>
        <div className="h-full overflow-hidden rounded-[inherit] bg-subtle">{img}</div>
        <figcaption className="mt-1.5 text-muted">
          <PhotoCredit image={image} label={labels.credit} />
        </figcaption>
      </figure>
    );
  }
  if (credit === "none") return <div className={cx("relative overflow-hidden bg-subtle", className)}>{img}</div>;
  return (
    <div className={cx("relative overflow-hidden bg-subtle", className)}>
      {img}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-5 pb-1.5 text-white">
        <PhotoCredit image={image} label={labels.credit} className="line-clamp-2" />
      </div>
    </div>
  );
}
