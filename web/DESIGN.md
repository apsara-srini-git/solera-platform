# Solera design system

The goal is clinical-research SaaS that is calm and trustworthy, with Linear/Stripe clarity and the easy browsing of
Idealista: photo cards, list ↔ map, and a page you understand within a second. Light theme only.

## Tokens (`src/app/globals.css`, Tailwind v4 `@theme`)

| Group | Tokens → classes | Use |
|---|---|---|
| Brand teal | `brand-50 … brand-900` (`bg-brand-600`, `text-brand-700`) | Primary actions, active nav, selected states. `brand-600` is the primary button (white text 5.3:1). |
| Surfaces | `canvas` (page), `surface` (cards/header), `subtle` (wells, hovers, table heads) | `bg-canvas`, `bg-surface`, `bg-subtle` |
| Lines | `line` (hairlines), `line-strong` (inputs, dashed empties) | `border-line` |
| Ink | `ink` (primary), `ink-2` (secondary), `muted` (captions, 4.7:1 on white) | `text-ink`, `text-ink-2`, `text-muted`. Never use colour as the only signal for text. |
| Score | `score-1 … score-5` | Only through `src/lib/score-scale.ts` (see below). |
| Status | Tailwind `emerald / amber / rose / sky` via `<Badge tone>` | Success, warning, danger, info. Always paired with a word. |
| Shadow | `shadow-xs`, `shadow-card`, `shadow-raised` (hover), `shadow-pop` (menus, dialogs) | |
| Radius | `rounded-md` (6) for small controls, `rounded-lg` (8) for buttons and inputs, `rounded-xl` (12) for cards, `rounded-2xl` for dialogs and hero panels | |
| Type | Inter (`font-sans`, base 15px, `cv11 ss01 ss03`), Geist Mono (`font-mono`) | Use the `num` utility for tabular numbers. Headings are `font-semibold tracking-tight`. |
| Layout | `--header-h` (60px), `h-below-header`, `full-bleed` | The page container is `max-w-7xl`. Use `full-bleed` to break out of it, e.g. for a full-width map. |

The legacy utilities `card`, `btn-primary`, `btn-secondary`, `btn-danger`, `input`, `label` and `chip` still work and use
the tokens. Two utilities are new: `btn-ghost` and `card-interactive`. A `select.input` element gets a chevron
automatically. Focus uses one ring everywhere: a 2px `brand-500` outline that appears only for keyboard focus.

## Score scale (`src/lib/score-scale.ts`)

The scale is an ordinal, single-hue teal ramp in 5 bins (0–19 … 80–100), going from light (low) to dark (high). It was
checked with the dataviz validator using `--ordinal`: lightness is monotone, the light end is ≥ 2:1 against the surface,
and it is one hue, so it stays ordered under colour-vision deficiency. Map markers also encode the score as size, and
badges always print the number.

```ts
scoreColor(72)              // { fill, stroke, text (on fill), bg (tint), ink (on tint/white), bin }
scoreRadius(72, { min: 6, max: 16 })  // px; marker area grows linearly with score
scoreLegend("es")           // [{ range: "0–19", label: "Baja", color, radius }, …]
scoreWord(72)               // "Strong" (next to the number, never instead of it)
```

Use the score colours only for **match scores**. For counts and shares (e.g. trials by area), use `<ScoreBar tone="neutral">`,
because colouring a bar by its length encodes the same thing twice.

## Components (`import { … } from "@/components/ui"`)

```tsx
<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading={pending} icon="send">Send</Button>
<ButtonLink href="/projects" variant="secondary" iconRight="arrowRight">Open</ButtonLink>
<Card padding="none|sm|md|lg" interactive as="article"><CardHeader title="Research setup" actions={…} /></Card>
<Badge tone="neutral|brand|info|success|warning|danger|premium|outline" dot>Recruiting</Badge>
<ScoreBadge score={82} showWord size="sm|md|lg" lang="es" />
<ScoreBar value={64} size="xs|sm|md" tone="score|neutral" label="Experience" />
<ScoreLegend variant="swatches|markers" lang="en" />
<SourceBadge kind="registry|catalogue|sermas|ceim|hospital|protocol" date="2025-03-01" href="…" lang="es" />
<StatGroup><Stat label="Beds" value="1,286" source={<SourceBadge kind="catalogue" />} /></StatGroup>
<SegmentedControl label="View" value={view} onChange={setView} options={[{value:"list",label:"List",icon:"list"}, …]} />
<ToggleChip pressed={on} onPressedChange={setOn} count={34}>MRI</ToggleChip>   <Chip onRemove={…}>Oncology</Chip>
<EmptyState icon="search" title="No sites match" description="…" action={<Button variant="secondary">Clear</Button>} />
<PageHeader breadcrumb={[{label:"My projects",href:"/projects"},{label:name}]} title={name} subtitle="…" meta={…} actions={…} />
<Stepper current="send" steps={WORKFLOW_STEPS.map(s => ({ ...s, href: `#${s.key}` }))} />
<Field label="Indication" htmlFor="ind" hint="…" error={err} aside={<SourceBadge …/>}><Input id="ind" name="indication" /></Field>
<Select>, <Textarea>, <Check label="…" hint="…" />, <Label optional>
<Tooltip content="…">…</Tooltip>   <InfoTip>Why this score?</InfoTip>      (CSS only, server-safe)
<Modal open onClose title footer>…</Modal>   <Drawer open onClose title>…</Drawer>  (native <dialog>: Esc, focus trap, backdrop click)
<Icon name="map" size={16} />   <NavLink href="/">…</NavLink>   <RouteSwitch prefixes={["/q"]} fallback={…}>…</RouteSwitch>
```

`SegmentedControl`, `Chip`/`ToggleChip`, `Modal`, `Drawer`, `NavLink` and `RouteSwitch` are client components. Everything
else is safe to render from server components. `SegmentedControl` also has a link mode: leave out `onChange` and give
each option an `href`.

## Page patterns

- **Search (list ↔ map).** The page uses `full-bleed`, with a sticky filter bar of ToggleChips and a `SegmentedControl` (List | Map | Split)
  on the right. In Split, a scrolling list of photo cards sits on the left (about 45%) and a sticky map of
  `h-below-header` on the right. Hovering a card highlights its marker, and clicking a marker scrolls to its card. Each
  card shows the photo on top (Commons credit on hover), the name, municipality and public/private badge, a
  `ScoreBadge` at the top right, 2–3 key facts (a stat is never repeated as a sentence on the card), and `MapLegend` on
  the map. The toolbar contents sit in the header's `max-w-7xl` container. Phones get a List/Map toggle only; hospital type
  and other filters live in the Edit search `Drawer`, and the shortlist CTA is a sticky full-width bottom bar
  ("N shortlisted · Continue"). Without any coordinates in the data, Map/Split are removed and the home page shows no map.
- **No photo.** `SitePhoto` without an image shows a building glyph, the municipality and "No photo yet" (never initials or
  numbers that could read as a count). On phones, result cards without a photo use a 48px `SiteAvatar` beside the name.
- **Score breakdown.** Show each component as points ("33 / 37 pts", weights normalised to 100) and, on the site page,
  where the hospital stands among Madrid hospitals ("top 3 of 70"). If the search would not have ranked the hospital
  (equipment, hospital type, no trial history), say so in an amber notice and mute the score.
- **Site detail.** `PageHeader` with a breadcrumb back to the search, then a hero photo with credit and a `StatGroup` of
  key numbers, each with a `SourceBadge`. Content is in two columns: facts on the left, scores and why on the right.
  Every fact carries its source. Dataset source fields may be "URL (note)": link only
  the URL (`splitSource` from `@/components/ui`; `SourceBadge` does this for `href`). The CEIm card shows committee facts with
  the AEMPS source only for `basis` "own" / "complex"; a defaulted committee is shown as "Not confirmed" with no source link.
- **Workflow (project).** `PageHeader` with the project name, and `Stepper` directly under it inside a `Card`. Each step
  is a section with one primary action. Use a `Modal` to confirm destructive or irreversible actions (send, approve,
  reject).
- **Hospital-facing (/q, /optout).** The shell hides sponsor navigation here. The copy is Spanish first, never shows the
  sponsor, drug or protocol code, and pre-filled answers appear as facts with a `SourceBadge` for the hospital to confirm.

## Copy tone

Plain, specific and calm. Use sentence case for everything, including buttons, which are verbs ("Send questionnaire").
Sponsor screens are in English and hospital screens in Spanish (formal *usted*). Say where a number comes from, and never
call an estimate a fact. Do not use exclamation marks or hype. Never show personal names, emails or phones.

## Maps (`src/components/map`)

Leaflet via react-leaflet, loaded client-only with `next/dynamic({ ssr: false })` from client wrappers (`MadridMap`,
`SiteMap`). Tiles are the public OpenStreetMap tiles with the required "© OpenStreetMap contributors" attribution, softened
by a CSS filter in `map.css`. **Production needs a tile provider plan** (e.g. a paid OSM-based provider such as MapTiler,
Stadia or Thunderforest, or self-hosted tiles): the OSM tile servers' usage policy does not allow heavy commercial use.
Markers: before a search all hospitals are neutral slate dots; after a search they are circle markers coloured AND sized by
`scoreColor` / `scoreRadius`, hospitals filtered out are faded with a dashed outline and hospitals without trial history are
small grey dots (`MapLegend mode="fit"`; on phones it starts as a one-line "Fit score" chip that expands on tap). Paint
order follows score (high on top) and is restored after every re-search and hover. The map refits Madrid whenever its
container gets a real size (e.g. List → Map on a phone) until the user drags, zooms or clicks it. Hospital photos (`SitePhoto`) always carry the Commons author + licence.
