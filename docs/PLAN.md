# Plan

Source brief: [docs/brief/MASTER_PROMPT_V2.md](brief/MASTER_PROMPT_V2.md) (42 sections).
Owner decisions: 2026-11-25. Progress is tracked in [STATUS.md](STATUS.md).

Legend: ✅ done in round 1 · 🟡 partly done · ⬜ not started

## P0 Plan ✅
- ✅ PLAN, ARCHITECTURE (stack and data model), DECISIONS, STATUS, and a public README marked all rights reserved.

## P1 App shell ✅
- ✅ Expo SDK 58 + TypeScript strict + Expo Router; one codebase for web, Android and iOS.
- ✅ Design system: warm, bright, rounded, high contrast.
  - Age-adaptive look: picture-first for 3-5, simple for 6-9, fuller for 10-17.
  - Accessibility options: dyslexia-friendly font, large text, high contrast.
- ✅ Layouts for phone, tablet, desktop and projector.
- ✅ i18n: all strings in `src/i18n/locales/en.json`, RTL-ready, and a unit test for missing keys.
- ✅ Offline storage with a sync queue; PWA manifest, service worker and offline cache.
- ✅ Accessibility labels and roles on every control; axe checks in e2e.
- ⬜ Hindi and Gujarati UI translations (round 2 and 3).

## P2 Families and modes ✅
- ✅ Family set-up: name, country, modes A-H, parent PIN, consent.
- ✅ Learner profile with every field in brief section 2.
- ✅ Parent PIN gate for the parent, tutor, classroom, account and print areas.
- ✅ Child home: current mission, today's learning, skills, projects, achievements, books,
  questions, interests and goals.
- ✅ Parent dashboard: everything in section 32 to see, plus controls for subjects, sensitive
  topics, worldview, language, hours, intensity, screen time and resources.
- ✅ Tutor dashboard: everything in section 33, with recommendations such as accelerating a strong
  subject or connecting an interest (for example fractions with recipes).
- 🟡 Equipment is set per child in the profile, not yet as a family-level inventory.

## P3 Learning engine ✅
- ✅ A dynamic learning map per child, with levels separate from age.
- ✅ Competency stages from Knows to Can teach, with adult confirmation.
- ✅ Skill trees with visible progress (44 trees).
- ✅ The what-next recommender: age, development, knowledge, skill, interest, health, language,
  culture, environment, goals and performance, with reasons.
- ✅ Interest pathways: horse, bicycle, animals, swimming, cycling and first-aid helper.
- ✅ Life Competency Passport (156 competencies, with targets such as "cook 10 meals").
- ✅ Green/Amber/Red safety ratings, Basic/Better/Advanced versions and substitutions on every
  practical activity (enforced by the validator).
- ✅ Decision simulations: leaking sink, someone collapsed, and 17 more.
- ✅ Projects and world projects; career families (55 careers).
- ✅ Gamification for effort, curiosity, persistence, mastery, cooperation and real-world skills;
  no streaks; daily screen-time limits.
- ⬜ Spaced review of mastered items; richer level models per skill-tree node.

## P4 Starter content ✅
- ✅ All 17 areas × 5 age bands: 389 items, 19 simulations and 37 projects.
- ✅ Content schema and a validator that fails CI on any missing safety rating, source, age band,
  substitution, version or review label.
- ✅ First aid: Red Cross / ILCOR-style guidance; knowledge kept separate from certified
  competency; certification notes pointing to accredited local courses.
- ✅ Emergency numbers for 66 countries with sources (43 verified, the rest marked unverified).
- ✅ Animal communication teaches observation and safety. Martial arts never encourage street
  fighting. Worldviews are comparative and neutral, and the parent picks the approach.
- ✅ Health pathways (owner decision 4): off by default, in parent, tutor or private mode, cited,
  labelled "Awaiting review by a medical professional".
- ✅ Vocabulary packs for study languages: ja, de, ru, zh, ar, fr, hi, gu and es.
- ⬜ Professional review: medical (health), first-aid instructor, native speakers for the
  vocabulary packs.
- ⬜ More items per band. Current spread: 3-5 has 85, 6-8 has 142, 9-11 has 156, 12-14 has 179
  and 15-17 has 136.

## P5 Accounts, sync and Progress Key ✅
- ✅ Worker API with D1:
  - email and password using PBKDF2, an email hash only, and a recovery key;
  - rate limits and sessions;
  - logout, export and delete account.
- ✅ Sync: a dirty queue, last-writer-wins records and an immutable event log, run when signing
  in, when the internet returns, after local changes and on a timer.
- ✅ Progress Key: code, link and QR, read-only passport, expiry, revoke and a hashed code.
- ✅ Printable passport that can be saved as a PDF.
- ✅ Tests for auth, sync conflicts, key revocation and expiry, and account deletion.
- ⬜ Passkeys (WebAuthn).
- ⬜ Merging two different families on one device.

## P6 Classroom ✅ (local-first)
- ✅ Groups (siblings, small group, classroom), attendance, group assignments and compatibility.
- ✅ Shared lessons that keep each child's own progress.
- ✅ Projector presentation mode with teacher controls, polls and collaborative questions.
- ⬜ Live polls from students' own devices (needs realtime: Durable Objects).
- ⬜ Attendance and polls synced to the cloud.

## P7 Quality and release 🟡
- ✅ Unit tests (58), Playwright e2e at phone, tablet, desktop and projector sizes (44 runs),
  axe accessibility checks, the content validator in CI, and a GitHub Actions workflow.
- ✅ Deploy script (`scripts/deploy.sh`): it creates D1, applies migrations and deploys one Worker.
- ⬜ Live deploy. Not done because `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` were not
  present in this run's environment.
- ⬜ Bundle-size budget. The entry chunk is about 300 KB gzipped; the target is under 200 KB.
- ⬜ Native store builds (they need the owner's Apple and Google accounts and EAS).

## Later rounds
1. Deploy, then run the e2e suite against the live URL.
2. Hindi UI, then Gujarati UI, plus translated content for the most-used items.
3. Professional reviews of content (medical, first aid, languages) and a translation workflow.
4. Passkeys; parent and tutor collaboration (inviting a tutor to an account with limited roles).
5. Realtime classroom (student devices vote in polls); attendance sync; class reports.
6. Native builds (Android first) with EAS; share sheet for exports; native print.
7. AI tutor, only if the owner chooses a provider and budget (the seam is ready).
