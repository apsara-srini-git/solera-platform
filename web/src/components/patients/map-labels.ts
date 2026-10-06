import { dict, locale } from "@/lib/patients/i18n";
import type { Lang } from "@/lib/patients/types";
import type { PatientMapLabels } from "./PatientMapInner";

export function mapLabels(lang: Lang): PatientMapLabels {
  const d = dict(lang);
  return {
    aria: d.mapAria,
    loading: d.mapLoading,
    legendTitle: d.legendTitle,
    legendText: d.legendText,
    legendSingle: d.legendSingle,
    legendToggle: d.legendToggle,
    countOne: d.popupCountOne,
    countOther: d.popupCountOther,
    recruiting: d.popupRecruiting,
    notYet: d.popupNotYet,
    unknown: d.popupUnknown,
    seeTrials: d.popupSeeTrials,
    hospital: d.popupHospital,
    showAll: d.mapShowAll,
    photoCredit: d.photoCredit,
    photoAlt: d.photoAlt,
    noPhoto: d.noPhoto,
  };
}

export const mapLocale = locale;
