# Status

**Round 3** (unattended cloud run, 2026-11-25). Branch: `claude/home-tutor-round-3-4xkg72`,
fast-forwarded to `main`. Rounds 1 and 2 are summarised below.

## Live links

- **App and API (normal edition):** https://home-tutor.german-journey.workers.dev
  (Worker `home-tutor`, D1 `home-tutor`). Round 2 is live there; the live e2e run passed 50 of 50.
- **Review edition (owner only, everything unlocked, not indexed):** https://home-tutor-unlocked.german-journey.workers.dev
  (Worker `home-tutor-unlocked`, its own D1 `home-tutor-unlocked`). Created by the first
  `bash scripts/deploy.sh unlocked` from the owner's PC.
- Round 3 is **not deployed yet**: this cloud environment has no Cloudflare keys. From the PC run
  `bash scripts/deploy.sh` (normal) and `bash scripts/deploy.sh unlocked` (review). There is no new D1
  migration this round; the deploy creates the live-classroom Durable Object (wrangler migration tag v1).
  Then: `E2E_BASE_URL=https://home-tutor.german-journey.workers.dev npx playwright test` and
  `E2E_UNLOCKED_URL=https://home-tutor-unlocked.german-journey.workers.dev npx playwright test --project=unlocked`.

## Done in round 3

1. **E2E clean-up fix.** The passkey test signed out (ending its first session) and then deleted the
   account with that old token: the API answered 401 and the account stayed. It now deletes with the
   passkey session and checks the account is gone. Every test address is written to a run ledger,
   and a final teardown project asks `POST /api/test/leftovers` how many of them still have an
   account; it must be 0. The route accepts only e2e-shaped `example.org` addresses (reserved
   domain), so it cannot probe real families (D-054).
2. **Unlocked review edition** (D-051): same code, `EXPO_PUBLIC_EDITION=unlocked`, its own Worker and
   D1. Everything open (lessons, skill trees, simulations, projects, books, passport items, health and
   puberty pathways with their source and review labels), no parent PIN, a ready-made review family,
   a banner on every screen, Browse everything (area, age band, safety rating, type, search) and View
   as (ages 3-17, girl, boy or mixed group, health on or off, with the normal gates), `noindex` and a
   `robots.txt` that disallows all. AI tutor still off. `deploy.sh unlocked` creates or reuses its database.
3. **Real photos** (D-052): **267** openly licensed photos (CC BY 107, CC BY-SA 98, public domain 37,
   CC0 25) across all 17 areas (each at least 9) and all age bands (3-5: 107, 6-8: 125, 9-11: 134,
   12-14: 151, 15-17: 119 photos linked). Self-hosted WebP (largest 58 KB, thumbnails under 16 KB,
   15.6 MB in all), lazy-loaded, cached for offline after viewing, alt text, credit on tap and hover,
   a Credits page, and `content/photos.json` with source, author, licence, licence URL and changes.
   Never on health lessons. The validator fails on a missing credit, a disallowed licence, a missing
   or oversized file or an unknown link. The entry bundle did not grow from photos.
4. **Reading list** (D-053): **293** real books (3-5: 61, 6-8: 81, 9-11: 57, 12-14: 45, 15-17: 49;
   157 fiction, 136 non-fiction), each verified in Open Library (work key), many Indian authors,
   23 with a Hindi and 22 with a Gujarati edition, 32 free and legal to read online (Project
   Gutenberg, Standard Ebooks, StoryWeaver). A Books screen with suggestions (interests, goals, home
   languages, parent approval, fiction and non-fiction balance) and original book cards (no publisher
   covers); I read it records the book in the Learning Passport; parents hide or approve books.
5. **Gujarati UI** (`gu.json`, every key, lazy chunk like Hindi; D-055), with e2e.
6. **Live classroom** (D-059): Durable Object rooms with a 6-character join code; students vote and
   ask questions from their own devices at `/join`; the projector shows live counts and questions.
   Server-side checks, no names or accounts (a random device id), rooms deleted after 12 hours.
7. **Spaced review** of mastered items in the what-next engine (3, 7, 21, 60, 120 days; D-056).
8. **Family equipment inventory** at set-up and in settings, used by the engine (D-057).
9. **Tutors:** a short session note the parent reads, stamped by the server with the tutor link;
   the parent's Tutors screen shows each tutor's sessions, minutes, lessons and notes (D-058).
10. **Content:** 18 new items for ages 6-8 in the nine weakest areas (5 simulations, 9 with checks).
11. Privacy page: live classes, self-hosted photos and book links.

## Done in round 2

1. **Owner updates.**
   - Live link at the top of README and this file.
   - `scripts/deploy.sh` fixed: the temporary config is now `wrangler.deploy.jsonc` at the repo root
     (gitignored, removed on exit), so `main`, `assets.directory` and `migrations_dir` resolve
     correctly. It checks `wrangler whoami`, so it works with OAuth on a PC and no
     `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`. New migrations 0002 and 0003 are additive.
   - Every e2e test that signs up deletes its account at the end, in a `finally` block, through
     `DELETE /api/account`; one test presses the real Delete-my-account button.
   - Privacy page contact: the public GitHub Issues page, with a warning not to post personal details.
   - Set-up follows the device locale (country and UI language), falling back to English; both can be
     changed at set-up and in Family settings.
   - The AI tutor stays off and hidden; no paid AI API is called.
2. **Tutor accounts.** A parent invites a tutor with a one-time code (7 days). The tutor signs in with
   their own account on their own device, opens *Tutoring*, enters the code and sees only the shared
   children. They can log sessions, mark lessons done together and change a few learning fields. They
   cannot delete anything, see the family record or other children, or make Progress Keys. The parent
   changes the shared children or removes the tutor at any time. Every rule is checked on the server
   (migration 0002), with 9 unit tests and an e2e test.
3. **Hindi UI** (`hi.json`, all keys) with a language picker at set-up and in Family settings. It is a
   lazy chunk (about 19 KB gzip). The i18n test checks every locale for missing, extra and
   untranslated keys and for broken placeholders.
4. **Bundle size.** The entry fell from 291 KB to **164 KB gzip** (everything on the first load:
   184 KB). On the web a small router shim replaces Expo Router's runtime, and every screen is lazy;
   Android and iOS keep Expo Router. CI runs `npm run check:bundle` (200 KB budget; 60 KB per chunk).
5. **Classroom.** Attendance syncs as records (one per group per day). A printable class report
   covers 7, 30 or 90 days: attendance, activities, group lessons, minutes, quiz average,
   adult-confirmed skills and areas.
6. **Content.**
   - 18 new items for ages 3-5, two each in financial literacy, independent learning, projects, arts,
     careers, civics, environment, philosophy and worldviews, and technology. All are picture-first
     and read-aloud friendly.
   - Emergency numbers: 21 of the 23 unverified countries are now verified from official government
     travel-advice pages, and 7 entries were corrected. Sri Lanka (fire number) and Indonesia stay
     unverified because the official sources disagree.
7. **Passkeys** (WebAuthn) as an optional extra sign-in on the web. Migration 0003; unit tests use a
   software authenticator and e2e uses Chromium's virtual authenticator.
8. **Native readiness.** On Android and iOS, exports open the share sheet (expo-sharing), and the
   print screen can share the passport file. The Android bundle builds (`expo export -p android`).

## Done in round 1

- **P0 Plan.** README (all rights reserved), PLAN, ARCHITECTURE, DECISIONS (33 decisions) and this
  STATUS file.
- **P1 App shell.** Expo SDK 58 with React Native Web and Expo Router, sharing one TypeScript
  codebase.
  - A warm design system with an age-adaptive look: picture-first for 3-5, simple for 6-9 and
    fuller for 10-17.
  - Layouts for phone, tablet, desktop and projector.
  - Accessibility options: dyslexia-friendly font, large text and high contrast.
  - i18n with every string in `en.json`, RTL-ready.
  - An original mascot, Sprout, drawn in SVG; app icons are rendered from the same SVG.
  - Read-aloud with the device's own text-to-speech.
  - An offline store with a sync queue.
  - The installable PWA has a manifest, a service worker and an offline cache, and has been
    tested offline.
- **P2 Families and modes.**
  - Family set-up covers name, country, modes A to H, a parent PIN and consent.
  - The learner profile has every field in brief section 2.
  - A PIN gate protects the parent, tutor, classroom, account and print areas.
  - The child home has the current mission, today's learning (fixed for the day), skill
    progress, projects, achievements, books, questions, interests and goals.
  - The parent dashboard and per-child view cover all of brief section 32.
  - The tutor dashboard covers brief section 33 with recommendations.
- **P3 Learning engine.**
  - A rule-based, offline what-next engine with reasons.
  - Levels are kept separate from age.
  - Competency stages run from Knows to Can teach, and adult confirmation is needed for the
    higher stages.
  - 44 skill trees and 6 interest pathways, including the horse and bicycle examples.
  - A Life Competency Passport with 156 competencies.
  - Green/Amber/Red safety ratings, Basic/Better/Advanced versions and material substitutions.
  - 19 decision simulations and 37 projects and world projects.
  - 55 careers across 16 families.
  - Gamification with no streaks, plus daily screen-time limits.
- **P4 Starter content.**
  - 389 items across all 17 areas and all 5 age bands. Per band: 3-5 has 85, 6-8 has 142, 9-11
    has 156, 12-14 has 179, 15-17 has 136.
  - Safety ratings: 113 green, 54 amber, 10 red.
  - A content schema and a validator in CI.
  - Health pathways are off by default and cited, and each lesson is labelled "Awaiting review by
    a medical professional".
  - First aid follows Red Cross/ILCOR-style guidance and carries certification notes.
  - Emergency numbers for 66 countries: 43 verified, 23 marked unverified.
  - Vocabulary packs for 9 study languages.
- **P5 Accounts, sync and Progress Key.**
  - A Worker API on D1. Sign-in uses email and password; the password is hashed with PBKDF2 and
    only a hash of the email is stored. A one-time recovery key replaces email recovery.
  - Rate limits, sessions, export and delete-my-account.
  - Sync uses last-writer-wins for records and union for the event log.
  - A Progress Key comes as a code, link and QR. It opens a read-only passport, can expire and can
    be revoked, and only a hash of the code is stored.
  - The passport can be printed or saved as a PDF.
  - A privacy page in plain English.
- **P6 Classroom.**
  - Groups, attendance, group assignments and a compatibility score.
  - Shared lessons that keep each child's own progress.
  - A projector presentation mode with keyboard and remote control, polls and class questions.
- **P7 Quality.** Unit tests, Playwright e2e at four screen sizes with axe accessibility checks,
  and a GitHub Actions CI workflow.

## Test results (last local run)

| Check | Result |
|---|---|
| Content validator | **passed**: 425 items, 267 photos, 293 books, 0 errors |
| TypeScript (`tsc --noEmit`, strict) | **passed**: 0 errors |
| Unit tests (Vitest) | **114 / 114 passed**: API 24, engine 23, sync/crypto/content/i18n 19, tutors 10, books and photos 8, live classroom 6, review edition 4, spaced review 4, equipment 4, passkeys 4, locale 4, web router 3, tutor activity 1 |
| E2E (Playwright, Chromium) | **61 / 61 passed**: phone 30, tablet 8, desktop 8, projector 10, review edition 3, run set-up 1, no-leftovers check 1 |
| Accessibility (axe, WCAG 2 A/AA, serious and critical) | **0 violations** on the key screens at 4 sizes, plus Review, Join, Books and a lesson with a photo |
| Web bundle (`npm run check:bundle`) | entry **190 KB gzip** (budget 200 KB), both editions; 38 lazy chunks, the largest is Hindi at 21 KB |
| Worker bundle (`wrangler deploy --dry-run`) | builds, 140 KB gzip, bindings DB, CLASSROOM (Durable Object), ASSETS |

E2E clean-up: every test that signs up deletes its account, and the run fails if any is left.

## Content now

- 425 items. Per band: 3-5 has 103, 6-8 has 160, 9-11 has 162, 12-14 has 179, 15-17 has 136.
- Safety ratings: 128 green, 59 amber, 10 red. 23 simulations, 42 projects and world projects.
- 267 photos, 293 books, 55 careers, emergency numbers for 66 countries (64 verified).

## Not done or partly done (honest list)

- **Not deployed from here** (no Cloudflare keys); see Live links for the PC commands.
- **Gujarati and Hindi need a native speaker's review.** Gujarati notes from the helper: verbs kept
  gender-neutral, લિંગ for sex, ઍડવાન્સ for Advanced, પીળો for Amber.
- **Photos:** Wikimedia's servers rate-limited this sandbox, so most photos came through Openverse
  (Flickr) and NASA. Two photos are smaller than 800 px (small originals). Six CC0 photos have no
  named author ("Unknown"). Physical education, technology and money have the fewest photos (10-14).
- **Books:** Middle Eastern authors are thin for ages 3-8. Fifteen first-publish years were corrected
  where Open Library is plainly wrong (catalogue year kept in `verify`). A few one-line summaries for
  lesser-known picture books are deliberately general. Some book interests are broad (stories).
- **Live classroom** uses 2-second polling, not WebSockets; fine for a class, heavier for very large rooms.
- **Review-edition screens** are English only (D-051).
- **Passkeys are web-only**; native apps need the owner's Apple and Google developer accounts.
- **Native apps** are not built or tested on devices this round (the Android bundle built in round 2).
- **Professional review** (medical, first aid, languages) is still open; see the questions below.
- **Emergency numbers:** Sri Lanka and Indonesia still unverified.

## Open questions for the owner

1. **Language review.** Who can review `src/i18n/locales/hi.json` and `gu.json`?
2. **Medical and first-aid review.** Still open. Every health lesson is labelled *Awaiting review by a medical professional*.
3. **Expert checks** flagged in round 1 (abdominal thrusts for 12-17, raise their legs, low blood
   sugar timings, seizure wording, puberty age ranges, water safety, the be-a-tree dog advice, food
   chilling, horse feeding, carbon factors, naming Take It Down).
4. **Native store accounts (EAS, Apple, Google).** When should Android builds start?
5. **Review edition access.** It is public but unlisted and not indexed. Should it sit behind
   Cloudflare Access (free for small teams) so only the owner can open it?

## Next session prompt

HOME TUTOR - BUILD ROUND 4 (unattended cloud run). Nobody is watching: never ask questions, decide yourself and record each decision with its reason in docs/DECISIONS.md, and push your branch after every finished step (a save point at least every 15-20 minutes). Read docs/STATUS.md, docs/PLAN.md, docs/ARCHITECTURE.md and docs/DECISIONS.md first, then the brief docs/brief/MASTER_PROMPT_V2.md where needed. Work on a new claude/ branch from main. Up to 5 parallel helper agents are fine for research and content; you integrate and verify their work. The normal edition is live at https://home-tutor.german-journey.workers.dev and the review edition at https://home-tutor-unlocked.german-journey.workers.dev; both are deployed from the owner's PC with bash scripts/deploy.sh and bash scripts/deploy.sh unlocked. This cloud environment has no Cloudflare keys: do not deploy, keep everything deployable from the PC, keep D1 migrations additive (0001 to 0003 exist) and add a new Durable Object migration tag for any class change. Goals in order: (1) Live classroom over WebSockets with Durable Object hibernation, keeping the 2-second polling as a fallback, with tests. (2) Photos: raise physical education, technology and money to at least 20 photos each and add photos to more skill trees and careers, same licence, size, credit and child-safety rules, validator passing. (3) Books: add Middle Eastern, African and Latin American authors for ages 3-8 and more free StoryWeaver reads in Hindi and Gujarati, every book verified in Open Library. (4) Translate the most-used lesson content (titles and summaries of the 100 most recommended items) into Hindi and Gujarati, loaded lazily, with tests. (5) Richer level models per skill-tree node in the what-next engine, with unit tests. (6) Native Android build check (expo export -p android) and fix anything that breaks. (7) Content: at least 15 more items for ages 3-5 and 15-17 in the weakest areas. Keep the web entry bundle under 200 KB gzip (CI check), keep the rule that every e2e test that signs up deletes its account (the no-leftovers check must pass), keep all existing tests green, add tests for new work, keep CI passing, update docs/STATUS.md with test numbers and a new Next session prompt section (no double quotes in it), then fast-forward main to your branch and push both. Never commit secrets, account IDs, database ids, personal data or the owner name or email; do not add a licence; do not call any paid AI API; the AI tutor stays off and hidden.
