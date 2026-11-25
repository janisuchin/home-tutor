# Status

**Round 1** (unattended cloud run, 2026-11-25). Branch: `claude/home-tutor-build-round-1-y38fvz`,
fast-forwarded to `main`.

## Live links

- **App and API:** https://home-tutor.german-journey.workers.dev
- Deployed from the owner's PC from `main` (D1 database `home-tutor`, migration 0001 applied); the
  full Playwright suite passed against the live URL, 44 of 44. Round 2 work is deployed by the PC
  after this round (this cloud environment has no Cloudflare keys).

## Done

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
| Content validator | **passed**: 389 items, 0 errors |
| TypeScript (`tsc --noEmit`, strict) | **passed**: 0 errors |
| Unit tests (Vitest) | **58 / 58 passed** (engine 22, sync/crypto/content/i18n 15, API 21) |
| E2E (Playwright, Chromium) | **44 / 44 passed**: phone 19, tablet 8, desktop 8, projector 9 |
| Accessibility (axe, WCAG 2 A/AA, serious and critical) | **0 violations** on 6 key screens at 4 sizes |
| Worker bundle (`wrangler deploy --dry-run`) | builds, 23 KB |
| Web bundle | entry chunk 1.1 MB raw / about 296 KB gzip; route chunks 1-33 KB; content catalogue 238 KB raw |

## Content review done in this round

Two review agents checked the content against current guidance:
- **Health and first aid.** Corrected or updated, among others: period cycle length and when to
  see a doctor, nosebleed timing (10-15 minutes), choking steps (5 back blows, then 5 abdominal
  thrusts, then call), hypothermia as always an emergency, adrenaline pen before calling, and
  adult guidance for when a child discloses abuse.
- **Practical safety.** Raised four items to Amber: water play for ages 3-5, plaster of Paris,
  night sky-watching, and a conservation project. Removed unsafe substitutions (camping stove
  indoors, tyres for food plants, plastic bags for ages 3-5). Fixed wrong quiz answers (tally
  marks, R = 2). Simplified animal items for ages 3-5.

Quiz and simulation answers are now shuffled each time, because 177 of 239 quiz questions had the
right answer first.

## Not done or partly done (honest list)

- **Live deploy.** Not done: there are no Cloudflare credentials (see above).
- **Hindi and Gujarati UI.** Planned for rounds 2 and 3. The i18n structure is ready.
- **Professional review.** Health content needs a medical professional, first aid needs a
  certified instructor, and the vocabulary packs need native speakers. The Gujarati pack is the
  thinnest.
- **Some source links could not be fetched** from the build sandbox, probably because the proxy or
  the sites block automated requests: ifrc.org, redcross.org.uk, 911.gov, crtc.gc.ca,
  triplezero.gov.au, 112.gov.in and police.go.kr. They should be checked by hand.
- **Classroom features are local-first.** Polls and class questions live on the teacher's device.
  Attendance is not synced. There is no voting from students' own devices yet.
- **Native apps** are not built or tested yet. The code paths exist: bundled content, an API base
  URL and bundle ids. On native, delete confirmations use the web `confirm()` fallback (no
  dialog), and exports and printing are web-only.
- **Passkeys** are not implemented.
- **Bundle size.** The entry chunk is about 296 KB gzip; the target is under 200 KB.
- **Signing in on a device that already has a different family:** the two families are not merged.
  The last-written family record wins, but children from both are kept.

## Open questions for the owner

1. **Cloudflare.** Please add `CLOUDFLARE_API_TOKEN` (with Workers Scripts, D1 and Workers Routes
   edit rights) and `CLOUDFLARE_ACCOUNT_ID` to the cloud environment as secrets, so the next round
   can deploy and test against the live URL.
2. **Medical review.** Who will review the health and puberty lessons? Until then every one is
   labelled *Awaiting review by a medical professional*.
3. **Contact address for the privacy page.** It currently says contact details will be added later.
4. **Separate tutor accounts.** Should a tutor get their own login with access to only the
   children a parent shares (a role-limited invite)? Today a tutor uses the family's device and PIN,
   or a read-only Progress Key.
5. **Expert checks the reviewers flagged.**
   - Abdominal thrusts taught to ages 12-17 without a course.
   - The "raise their legs" advice for shock and fainting.
   - Timings for treating low blood sugar.
   - Seizure wording for ages 9-11.
   - All puberty age ranges.
   - Swimming and water-safety wording, checked by a qualified instructor.
   - The "be a tree" dog advice.
   - Food-chilling, horse-feeding and carbon-factor rules of thumb.
   - Whether the NCMEC "Take It Down" service may be named under the no-brand rule.
6. **Default country and language.** The current default is India and English. Should it follow
   the device locale instead?

## Next session prompt

HOME TUTOR - BUILD ROUND 2 (unattended cloud run). Nobody is watching: never ask questions, decide yourself and record each decision with its reason in docs/DECISIONS.md, and push your branch after every finished step (a save point at least every 15-20 minutes). Read docs/STATUS.md, docs/PLAN.md, docs/ARCHITECTURE.md and docs/DECISIONS.md first, then the brief docs/brief/MASTER_PROMPT_V2.md where needed. Work on a new claude/ branch from main. Goals in order: (1) If CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are in the environment, run scripts/deploy.sh, then run the Playwright suite against the live URL with E2E_BASE_URL set, fix anything that only fails live, and put the live links at the top of README.md and docs/STATUS.md; if they are missing, say so in STATUS.md and continue. (2) Add the Hindi UI locale (src/i18n/locales/hi.json, every key, natural child-friendly Hindi, with a language picker already in Family settings) and make sure the i18n unit test checks every locale for missing keys; keep Gujarati for round 3. (3) Cut the web entry bundle below 200 KB gzip without losing features (measure first; lazy-load QR code, svg-heavy screens and anything not needed on the first screen), and add a bundle-size check to CI. (4) Classroom: sync attendance to the cloud as records, and add a printable class report. (5) Add passkeys (WebAuthn) as an optional extra sign-in on the Worker, with tests. (6) Content: add at least 15 more items for ages 3-5 across the weakest areas (picture-first, read-aloud friendly), keep the validator passing, and re-check the 23 unverified emergency numbers. (7) Native readiness: replace window.confirm with a cross-platform confirm dialog component, and add a share-sheet export path for native. Keep all existing tests green, add tests for new work, keep CI passing, update docs/STATUS.md with test numbers and a new Next session prompt section, then fast-forward main to your branch and push both. Never commit secrets, account IDs, personal data or the owner name or email; do not add a licence; do not call any paid AI API.
