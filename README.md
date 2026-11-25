# Home Tutor

**Live app:** https://home-tutor.german-journey.workers.dev

Home Tutor is a free, child-friendly home-tutoring app for parents, tutors and teachers anywhere in
the world. It works with one child, several siblings, a small group or a whole classroom, for children
aged about 3 to 17.

It is not a copy of school. It combines core subjects with life skills, physical education, health,
first aid, nature and animals, civics, money, technology and AI, languages, arts, philosophy and
worldviews, the environment, careers, special interests, real projects and learning to learn, and it
keeps asking one question: **what does this particular child need next?**

## What it does

- **A personal learning map for every child.** Levels are separate from age. A rule-based engine
  that runs offline picks today's learning from age, level, interests, goals, health settings,
  languages, environment and past performance, and explains every suggestion.
- **Life Competency Passport.** It records what a child can actually do, not only grades:
  Knows → Understands → Can demonstrate → Can apply → Can teach. Steps above "understands" count
  only when an adult confirms them.
- **Skill trees** with visible progress, for example plumbing from Awareness to Professional pathway.
- **A safety engine.** Every practical activity is rated Green (safe alone), Amber (adult must be
  present) or Red (trained professional only). Each one also has a Basic (almost free), Better
  (low cost) and Advanced version, and ideas for what to use when you lack the equipment.
- **Real-world decision simulations**, such as a leak under the sink or someone who has collapsed,
  and projects that mix subjects, including world projects about other countries.
- **Interest pathways.** A love of horses or bicycles opens biology, maths, physics, economics,
  history and more.
- **Health and growing-up lessons.** These are written from WHO, UNESCO, NHS and similar guidance
  and cite their sources. They are **off by default** and switched on per child by the parent, with
  parent-guided, tutor-guided or private modes. Every lesson is labelled *Awaiting review by a
  medical professional*. Gender only switches on the relevant health modules; it never limits what
  a child may learn.
- **Dashboards for parents, tutors and children**, a classroom mode with attendance and group work,
  and a projector or TV presentation mode with polls and class questions.
- **Progress Key.** A code, link or QR code opens a read-only Learning Passport for a new tutor or
  school. The parent can set an expiry and revoke it. There is also a printable passport that can
  be saved as a PDF.
- **Offline-first PWA.** It works without internet and syncs when the family signs in and when the
  connection returns. Content packs are small and served from the Cloudflare edge.
- **Privacy by design.** No ads, no trackers and no third-party analytics. Only minimal data is
  kept, children never have their own accounts, and there are export and delete-my-data buttons
  and a plain-English privacy page.
- **Built for low-cost devices.** Big touch targets, read-aloud using the device's own voice, a
  picture-first look for ages 3 to 5, a dyslexia-friendly font option, large text and high
  contrast. Everything works by touch, mouse, keyboard or TV remote.

## Tech

- **App:** one TypeScript codebase for web, Android and iOS, using Expo SDK 58, React Native Web
  and Expo Router.
- **Hosting:** the web build is a PWA served by a single Cloudflare Worker (`home-tutor`) from
  static assets.
- **API:** the same Worker serves `/api/*` with a D1 database. Accounts use email and password
  (PBKDF2), with a one-time recovery key instead of email, rate limits and sync.
- **Content:** JSON packs in `content/`, checked by `scripts/validate-content.ts`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PLAN.md](docs/PLAN.md),
[docs/DECISIONS.md](docs/DECISIONS.md) and [docs/STATUS.md](docs/STATUS.md).

## Run it

```bash
npm ci
npm run validate          # content validator (fails on missing safety, sources, ages, substitutions)
npm run content           # build offline content packs
npm run web               # dev server (Expo)
npm test                  # unit tests (engine, sync, API, content, i18n)
npm run build:web         # production PWA in dist/
npm run serve             # serve dist/ + a local API on http://localhost:8787
npx playwright test       # end-to-end tests at phone, tablet, desktop and projector sizes
```

Deploy with `scripts/deploy.sh` after `npx wrangler login` (OAuth on a PC) or with
`CLOUDFLARE_API_TOKEN` set. It builds the PWA, finds or creates the D1 database, applies any new
migrations and deploys the Worker.

## Licence

**All rights reserved** until the owner chooses a licence. The source is public so the app can be
reviewed and built openly, but no licence to reuse it is granted yet.
