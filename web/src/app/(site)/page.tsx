import { currentUser, ownedProject } from "@/lib/auth";
import { dataset } from "@/lib/data";
import { db } from "@/lib/db";
import { refreshStatus, sourceDates } from "@/lib/refresh";
import { parseCriteria } from "@/lib/search";
import type { MapSite } from "@/components/map/types";
import type { TrialCriteria } from "@/lib/types";
import SearchClient from "./search-client";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { project: projectId, c, site, any } = await searchParams;
  const project = typeof projectId === "string" ? await ownedProject(projectId) : null;
  const shortlisted = project
    ? (await db.shortlistItem.findMany({ where: { projectId: project.id }, select: { siteId: true } })).map((i) => i.siteId)
    : [];
  const { sites, report } = dataset();

  // ?c= (back from a site page / shared link) wins over the project's stored criteria
  let initialCriteria: TrialCriteria | null = null;
  try {
    if (typeof c === "string") initialCriteria = parseCriteria(JSON.parse(c));
  } catch {}
  if (!initialCriteria?.indication) initialCriteria = project ? parseCriteria(JSON.parse(project.criteria)) : null;

  // client-safe hospital summaries for the map and result cards (public facts only, no contacts)
  const mapSites: MapSite[] = sites.map((s) => ({
    id: s.id,
    name: s.name,
    municipality: s.municipality,
    ownership: s.ownership,
    beds: s.beds,
    lat: s.geo?.lat ?? null,
    lon: s.geo?.lon ?? null,
    image: s.image ?? null,
    institute: s.researchUnit?.institute ?? null,
    accreditedIIS: !!s.researchUnit?.accreditedIIS,
    trialCount: s.trialCount,
  }));

  return (
    <SearchClient
      key={project?.id ?? "anon"}
      initialCriteria={initialCriteria}
      initialProjectId={project?.id ?? null}
      initialShortlist={shortlisted}
      initialAnyway={any === "1"}
      initialSiteId={typeof site === "string" && sites.some((s) => s.id === site) ? site : null}
      sites={mapSites}
      stats={{ hospitals: report.hospitals ?? sites.length, trials: report.trials }}
      refresh={refreshStatus()}
      loggedIn={!!(await currentUser())}
      sourceDates={sourceDates()}
    />
  );
}
