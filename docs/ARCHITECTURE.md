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
 │  /api/*  auth, passkeys, sync, tutors, Progress Keys, export, delete, AI stub│
 │  else    static assets (dist/) from the edge, SPA fallback                  │
 │  D1: accounts, sessions, records, progress_keys, snapshots, rate_limits,    │
 │      tutor_links (0002), passkeys + webauthn_challenges (0003)              │
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

- **Mutable records** (`family`, `child`, `group`, `assignment`, `attendance`) merge last-writer-wins on
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

### Attendance records (round 2)

One `attendance` record per group per day: id `groupId:day`, data `{ groupId, day, childIds }`,
last-writer-wins. The class report (`src/core/engine/class-report.ts`) is built from attendance and
the event log on the device.

### Tutor accounts (round 2)

```
 parent account ──invite code (hash only, 7 days, one use)──► tutor_links row ◄── tutor account
        │                                                          │ child_ids (shared)
        └── records (family, children, events, ...)                │
                      ▲  read: shared live children + their events  │
                      └──  write: new events (by = tutor) and 6 learning fields of shared children
```

- Parent routes: `POST/GET /api/tutors`, `PUT/DELETE /api/tutors/:id` (only the parent's own links).
- Tutor routes: `POST /api/tutor/accept`, `GET /api/tutor/links`, `POST /api/tutor/links/:id/sync`.
- The server never returns the family record (it holds the PIN hash) to a tutor, rejects deletes and
  any other record kind, and overlays only `levelOverrides`, `interests`, `goals`, `strengths`,
  `growingAreas` and `learningStyles` onto the parent's child record. A removed link answers 403 and
  the tutor's device forgets that family. Tutored families live in their own device store
  (`src/data/tutoring.ts`).

### Passkeys (round 2)

Optional extra sign-in on the web with `@simplewebauthn/server` in the Worker and
`@simplewebauthn/browser` (lazy) in the app. Discoverable credentials, attestation `none`, relying
party = request host, the page origin must match it, single-use 5-minute challenges, public keys
only. Password and recovery key keep working.

### Editions (round 3)

`EXPO_PUBLIC_EDITION=unlocked` builds the review edition into `dist-unlocked/`; `scripts/deploy.sh
unlocked` deploys it as Worker `home-tutor-unlocked` with D1 `home-tutor-unlocked` and
`EDITION=unlocked`. `src/core/edition.ts` is the only place that reads the flag. In the review
edition `visibilityFor()` opens everything (Amber/Red keep their adult flags), there is no PIN, a
banner shows on every screen, and `/review` has Browse everything and View as (`src/core/engine/review.ts`).
View-as learners (`viewas-*`) and the `strict` option keep the normal gates. `index.html` is
`noindex`, `robots.txt` disallows all.

### Live classroom (round 3)

```
 projector (teacher) --POST /api/class/rooms--> Worker --> Durable Object ClassroomRoom (one per code)
 student phones ------/api/class/rooms/:code--> Worker -->   poll, ballots (1 per device id), questions
                     every 2 s (HTTPS)                        deleted after 12 hours
```

Room rules are pure functions (`src/core/classroom-room.ts`) used by the Durable Object
(`api/src/classroom.ts`), the local test server and unit tests (`api/test/do-memory.ts`). The host key
is stored only as a hash; students have a random device id and no name.

### Photos and books (round 3)

- `content/photos.json`: every photo's credit (source page, author, licence and URL, changes),
  alt text and the content ids it illustrates. Files are WebP in `public/photos/` (at most 800 px,
  60 KB; thumbnails 16 KB), served by the Worker itself (never hotlinked), `loading="lazy"`, cached
  by the service worker after the first view. The credits file is a lazy content file, so photos add
  nothing to the entry bundle. Health lessons never get photos. The validator fails on a missing
  credit, a disallowed licence, a missing or oversized file or an unknown link.
- `content/books.json`: real books only, each with an Open Library work key, band, type, genre,
  interests, areas, a why-read-it line, content notes and optional free legal reading links.
  `src/core/engine/books.ts` suggests books (band and the band below, interests, goals, languages
  spoken, parent approval, fiction/non-fiction balance); parents hide or approve books
  (`Family.settings.bookPrefs`); a book read is a `book` event with `bookId`, so it reaches the passport.

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
- **spaced.ts** (round 3): spaced review of mastered items (3, 7, 21, 60, 120 days), one a day in the plan.
- **equipment.ts** (round 3): the family equipment inventory; items needing gear the family has move up, missing gear moves them down.
- **books.ts**, **review.ts**, **tutor-activity.ts** (round 3): reading suggestions, the review edition, a parent's view of each tutor's sessions and notes.

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
  Non-English UI languages are lazy chunks.
- **Web router shim (round 2).** On the web, Metro maps `expo-router` imports from `src/` to
  `src/nav/expo-router.web.tsx` (see `metro.config.js`), and the web entry is `index.web.js`. The shim
  supports what the app uses (push, replace, back, canGoBack, useLocalSearchParams, Stack, Slot,
  Link) on top of the History API, with an explicit lazy route table (`src/nav/routes.web.ts`, kept
  in step with `src/app` by a unit test). Android and iOS use the real Expo Router (`index.js`). The
  entry is 164 KB gzip; CI fails above 200 KB (`npm run check:bundle`).

## Security and privacy

- **Passwords:** PBKDF2-SHA256 with 100,000 iterations (the Workers maximum) and a 16-byte random
  salt; comparisons are constant-time.
- **Email:** stored only as `SHA-256("home-tutor:email:" + normalised email)`. No email is ever
  sent.
- **Sessions:** random 256-bit tokens, stored hashed, lasting 90 days.
- **Recovery key:** one random 20-character key, stored hashed and rotated on each use; using it
  signs out every session.
- **Rate limits** (fixed windows in D1; round 2 adds tutor-invite accepts, 10 per account and 30 per IP
  per hour, and passkey sign-in options, 30 per IP per hour):
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
- **Exports:** `src/ui/download.native.ts` writes to the cache and opens the share sheet
  (expo-sharing); the web version downloads a file.
- **API address:** `src/data/api.ts` uses `app.json` `extra.apiBase` or the default Workers URL.
- **Store builds:** these need the owner's Apple and Google accounts and an EAS project. Bundle
  ids are already set (`app.hometutor`).
