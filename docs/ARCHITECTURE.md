# Architecture

## Overview

```
 Phone / tablet / desktop / projector browser (PWA)        Android / iOS (later, same code)
 ┌──────────────────────────────────────────────┐          ┌───────────────────────────┐
 │ Expo Router screens (src/app)                │          │ same screens, content     │
 │ UI kit + Sprout mascot (src/ui)              │          │ bundled in the app        │
 │ Device store + sync queue (src/data)         │          └─────────────┬─────────────┘
 │ Core engine, pure TS (src/core)  ◄──────────────── shared ────────────┤
 │ Service worker: app shell + content cache    │                        │
 └───────────────┬──────────────────────────────┘                        │
                 │ same origin                                           │ HTTPS + bearer token
 ┌───────────────▼───────────────────────────────────────────────────────▼─────┐
 │ Cloudflare Worker "home-tutor" (api/src/index.ts)                           │
 │  /api/*  auth, sync, Progress Keys, export, delete, AI-tutor stub           │
 │  else    static assets (dist/) from the edge, SPA fallback                  │
 │  D1 database: accounts, sessions, records, progress_keys, snapshots, limits │
 └─────────────────────────────────────────────────────────────────────────────┘
```

- **One codebase.** Expo SDK 58 + React Native Web + Expo Router. Routes live in `src/app`.
  Non-route code lives in `src/core` (pure logic, shared with the Worker and the tests), `src/data`
  (device store, API client, sync), `src/content` (content loaders), `src/ui` (design system) and
  `src/i18n`.
- **One Worker.** It serves the PWA and the API, so the API is same-origin and there is only one
  deploy. See DECISIONS D-004.
- **Offline-first.** The whole family state lives on the device (AsyncStorage, which is
  localStorage on the web). Changes are queued as "dirty" record keys and sent when the family is
  signed in and online.

## Data model (the brief's "Learning OS")

`Child → Development Profile → Core Curriculum → Skills → Interests → Projects → Competencies →
Assessments → Languages → Health → Physical Development → Portfolio`

| Brief concept | Where it lives |
|---|---|
| **Child** | `Child` in `src/core/model.ts`: a first name or nickname, an avatar, birth year and month only |
| **Development profile** | The `Child` fields for country, languages, education level, learning environment, equipment, outdoor space, supervision, learner types, strengths, growing areas, learning styles and physical notes |
| **Core curriculum** | Content `AreaPack`s (17 areas) in `content/areas/*.json`; the parent can switch areas off with `Child.areasOff`; `Family.settings.intensity` and `weeklyHours` set the pace |
| **Skills** | `SkillTree` with ordered nodes; items advance nodes through `ContentItem.skills` |
| **Interests** | `Child.interests` (tags), matched to item interest tags and `Pathway`s |
| **Projects** | `ContentItem.kind = project / world-project`, each with Basic/Better/Advanced versions |
| **Competencies** | `Competency` catalogue (Life Competency Passport) with targets, e.g. "cook 10 meals". Stages are Knows → Understands → Can demonstrate → Can apply → Can teach |
| **Assessments** | `check` questions and `simulation` decision trees, stored as `check` / `simulation` events with a score |
| **Languages** | `Child.languagesSpoken`, `studyLanguages`; `VocabPack` per study language; `ContentItem.languageHooks` weave the vocabulary into lessons |
| **Health** | `Child.health.modules` (all off by default) and `Child.health.guidance` (parent / tutor / private); gated `healthModule` items |
| **Physical development** | The `physical-education` area, its skill trees (swimming, skating, martial arts, fitness, cycling) and `Child.physicalNotes` |
| **Portfolio** | `ProgressEvent` log, built into a `PassportSnapshot` (`src/core/engine/passport.ts`) |

### Progress is an event log

`ProgressEvent` records are append-only: completed, check, simulation, stage, evidence, question,
book, minutes and attendance. Everything else is derived from them by `deriveProgress()`: levels per
subject, competency stages, evidence counts, skill-tree nodes and achievements. Because events
never change, sync never has a conflict on progress. Two devices can both work offline and simply
take the union of their events.

### Records and sync

Every synced thing is a `SyncRecord { kind, id, updatedAt, deleted?, data }` (`src/core/sync/merge.ts`).

- **Mutable records** (`family`, `child`, `group`, `assignment`) merge last-writer-wins on
  `updatedAt`. If two writes have the same time, the deletion wins, and otherwise a stable
  comparison of the content decides, so every device ends up the same.
- **Events** are immutable: the first write wins.
- **Server:** the client sends dirty records and its cursor. The server keeps the winners, gives
  each one a per-account sequence number, and returns every record after the cursor.
- **Deleting a child** cascades to their events, passport snapshot and Progress Keys.

### Progress Key

The parent's device generates a random 12-character code without look-alike letters. The server
stores only `SHA-256(code)` with the child id, an expiry and a revoked flag. After each sync the
device uploads a `PassportSnapshot` (first name, age, capabilities, levels, skill trees, projects,
books and languages) for every child that has an active key. `GET /api/passport/:code` returns the
snapshot while the key is valid, and is rate limited per IP. The printable passport (`/print/:id`)
uses the same view and works offline without an account.

## The engines (src/core/engine)

- **gating.ts** decides what a child may see:
  - health modules show only when switched on and only within their own age bands;
  - switched-off areas are hidden;
  - other items are limited to the child's age band and one band either side;
  - the worldview setting is respected;
  - Amber and Red items are flagged as needing an adult or a professional.
- **recommend.ts** is the what-next engine. It scores each visible item for:
  - age band;
  - closeness to the child's level in that subject;
  - whether it is already done, and whether a failed check should be retried;
  - recent struggle in the subject;
  - interest and goal matches;
  - balance across areas;
  - being the next node in a skill tree the child has started;
  - language hooks, culture (world projects) and health modules;
  - supervision and outdoor space;
  - physical activity every day.

  Each score comes with readable reasons. `todayPlan()` picks a balanced, time-boxed plan, at most
  one item per area and always with some movement; the plan is then frozen for the day.
  `currentMission()` picks a project.
- **progress.ts** builds the event log into levels, stages, evidence and skill nodes.
- **insights.ts** gives tutor and parent suggestions: rapid progress, connecting an interest to a
  lesson, competency gaps and safety warnings. It also scores group compatibility (health lessons
  are never shared) and works out achievements for effort, curiosity, persistence, mastery,
  cooperation and real-world skills. There are no streaks.
- **passport.ts** builds the Learning Passport snapshot.

## Content

- `content/areas/<area>.json` holds one `AreaPack` per area, with its items, skill trees,
  competencies and pathways. The schema is in `src/core/content-types.ts`.
- `scripts/validate-content.ts` fails the build on:
  - missing safety ratings, project versions, substitutions or age bands;
  - missing sources on health, first-aid and Amber/Red items;
  - a missing medical-review label on health items;
  - a missing certification note on practical first aid;
  - broken references, duplicate ids, and any area without items for every age band.
- `scripts/build-content.ts` writes `public/content/` for the web and `src/content-generated/` for
  native builds:
  - a 238 KB catalogue: the light index the engine needs;
  - the full area packs, fetched on demand;
  - emergency numbers, careers and vocabulary packs.

## PWA and performance

- **Web export.** `expo export -p web` produces a single-page app with route-level code splitting,
  so each screen is a small lazy chunk.
- **Offline support.** `scripts/postbuild-pwa.ts` adds:
  - a manifest and icons;
  - a service worker that precaches the app shell and catalogue, serves content packs
    stale-while-revalidate, caches hashed bundles cache-first and never caches `/api`;
  - print styles.
- **Small downloads.** The dyslexia-friendly font downloads only when a family switches it on.
  The current entry bundle is about 300 KB gzipped (see STATUS for the size goals).

## Security and privacy

- **Passwords:** PBKDF2-SHA256 with 100,000 iterations (the Workers maximum) and a 16-byte random
  salt; comparisons are constant-time.
- **Email:** stored only as `SHA-256("home-tutor:email:" + normalised email)`. No email is ever
  sent.
- **Sessions:** random 256-bit tokens, stored hashed, lasting 90 days.
- **Recovery key:** one random 20-character key, stored hashed and rotated on each use; using it
  signs out every session.
- **Rate limits** (fixed windows in D1):
  - signup: 10 per IP per hour;
  - login: 5 per account per 15 minutes and 30 per IP per hour;
  - recovery: 5 per account and 20 per IP per hour;
  - passport reads: 60 per IP per hour.
- **Parent PIN:** an iterated, salted SHA-256 hash stored on the device. It is a soft lock that
  keeps children out of the parent areas on a shared device; it is not account security. The
  unlock lasts 15 minutes and is kept in memory only.
- **Headers:** `_headers` sets nosniff, no-referrer, a Permissions-Policy that denies camera,
  microphone and geolocation, and DENY framing.

## AI tutor seam (off)

There is an `AiTutor` interface (`src/core/ai-tutor.ts`), a stub route `/api/ai-tutor` that always
answers 501, and `FamilySettings.aiTutor` typed as `false`, so it is hidden. No provider is called
and no key exists.

## Native builds (later)

- **Native content:** `src/content/loader.ts` (native) bundles all content.
- **API address:** `src/data/api.ts` uses `app.json` `extra.apiBase` or the default Workers URL.
- **Store builds:** these need the owner's Apple and Google accounts and an EAS project. Bundle
  ids are already set (`app.hometutor`).
