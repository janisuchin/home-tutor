# Status

**Round 2** (unattended cloud run, 2026-11-25). Branch: `claude/home-tutor-round-2-3qphas`,
fast-forwarded to `main`. Round 1 is summarised under *Done in round 1* below.

## Live links

- **App and API:** https://home-tutor.german-journey.workers.dev
- Deployed from the owner's PC from `main` (D1 database `home-tutor`, migration 0001 applied); the
  full Playwright suite passed against the live URL, 44 of 44. Round 2 work is deployed by the PC
  after this round (this cloud environment has no Cloudflare keys).

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
| Content validator | **passed**: 407 items, 0 errors |
| TypeScript (`tsc --noEmit`, strict) | **passed**: 0 errors |
| Unit tests (Vitest) | **83 / 83 passed**: API 22, engine and class report 23, sync/crypto/content/i18n 18, tutors 9, passkeys 4, locale 4, web router 3 |
| E2E (Playwright, Chromium) | **50 / 50 passed**: phone 25, tablet 8, desktop 8, projector 9 |
| Accessibility (axe, WCAG 2 A/AA, serious and critical) | **0 violations** on 6 key screens at 4 sizes, plus the Tutors, Tutoring, Passkeys and Class report screens |
| Web bundle (`npm run check:bundle`) | entry **164 KB gzip**; first load in total 184 KB (budget 200 KB); 32 lazy chunks, the largest is Hindi at 19 KB |
| Worker bundle (`wrangler deploy --dry-run`) | builds, 137 KB gzip (the WebAuthn library) |
| Android bundle (`expo export -p android`) | builds |

E2E clean-up: every test that signs up deletes its account, so a live run leaves no data behind.

## Content now

- 407 items. Per band: 3-5 has 103, 6-8 has 142, 9-11 has 156, 12-14 has 179, 15-17 has 136.
- Safety ratings: 118 green, 59 amber, 10 red.
- Emergency numbers: 66 countries, 64 verified.

## Not done or partly done (honest list)

- **Not deployed from here.** This environment has no Cloudflare keys. The owner's PC should run
  `scripts/deploy.sh`, which applies migrations 0002 (tutors) and 0003 (passkeys), and then the e2e
  suite against the live URL.
- **Hindi needs a native speaker's review.** Helper agents drafted it and the tests check it is
  complete. Their notes:
  - Some strings use both gender forms (रहा/रही).
  - Amber is shown as पीला (yellow).
  - "Advanced" became मुश्किल ("hard").
- **Gujarati UI** is planned for round 3.
- **Passkeys are web-only.** Native passkeys need associated domains tied to the owner's Apple and
  Google developer accounts.
- **Classroom polls** still live on the teacher's device; voting from students' own devices needs
  realtime (Durable Objects).
- **Native apps** build as bundles but are not built or tested on devices; store builds need the
  owner's EAS, Apple and Google accounts. Native printing still uses the share sheet instead of a PDF.
- **Professional review** (medical, first aid, languages) is still open; see the round 1 questions below.
- **Emergency numbers:** Sri Lanka and Indonesia are unverified. travel.state.gov,
  smartraveller.gov.au and Indonesia's 112 portal could not be fetched from the sandbox.
- **Signing in on a device that already has a different family:** the two families are not merged
  (unchanged from round 1).

## Open questions for the owner

1. **Hindi review.** Who can review `src/i18n/locales/hi.json`?
2. **Medical and first-aid review.** Still open from round 1. Every health lesson is labelled
   *Awaiting review by a medical professional*.
3. **Expert checks** flagged in round 1:
   - abdominal thrusts for ages 12-17;
   - the "raise their legs" advice;
   - timings for treating low blood sugar;
   - seizure wording;
   - puberty age ranges;
   - water-safety wording;
   - the "be a tree" dog advice;
   - food-chilling, horse-feeding and carbon-factor rules of thumb;
   - whether "Take It Down" may be named.
4. **Native store accounts (EAS, Apple, Google).** When should Android builds start?

## Next session prompt

HOME TUTOR - BUILD ROUND 3 (unattended cloud run). Nobody is watching: never ask questions, decide yourself and record each decision with its reason in docs/DECISIONS.md, and push your branch after every finished step (a save point at least every 15-20 minutes). Read docs/STATUS.md, docs/PLAN.md, docs/ARCHITECTURE.md and docs/DECISIONS.md first, then the brief docs/brief/MASTER_PROMPT_V2.md where needed. Work on a new claude/ branch from main. The app is live at https://home-tutor.german-journey.workers.dev and is deployed from the owner's PC; this cloud environment has no Cloudflare keys, so do not deploy, keep everything deployable, and keep new D1 migrations additive (0001 to 0003 exist). Goals in order: (1) Add the Gujarati UI locale (src/i18n/locales/gu.json, every key, natural child-friendly Gujarati, loaded lazily like Hindi) and keep the i18n tests green for every locale. (2) Realtime classroom: let students vote in polls and send class questions from their own devices with a short join code, using a Durable Object, with server-side checks, tests and no personal data. (3) Spaced review of mastered items in the what-next engine, with unit tests. (4) A family-level equipment inventory used by the engine and set-up. (5) Tutors: let a tutor add a short session note that the parent sees, still with no delete rights; and a parent view of tutor activity. (6) Content: at least 15 more items for ages 6-8 in the weakest areas, keep the validator passing. (7) Keep the web entry bundle under 200 KB gzip (CI check) and the e2e suite clean-up rule (every test that signs up deletes its account). Keep all existing tests green, add tests for new work, keep CI passing, update docs/STATUS.md with test numbers and a new Next session prompt section (no double quotes in it), then fast-forward main to your branch and push both. Never commit secrets, account IDs, database ids, personal data or the owner name or email; do not add a licence; do not call any paid AI API; the AI tutor stays off and hidden.
