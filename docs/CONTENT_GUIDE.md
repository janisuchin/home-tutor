# Content guide (for writers and reviewers)

All learning content lives in `content/`. The schema is `src/core/content-types.ts`; the validator is
`scripts/validate-content.ts` (run `npx tsx scripts/validate-content.ts`). CI fails if the validator fails.

## Files

- `content/areas/<area>.json` - one `AreaPack` per learning area (17 areas, see `AREA_IDS`).
  Each pack holds its own `skillTrees`, `competencies` (Life Competency Passport entries), `items`
  and optional interest `pathways`. Item ids, skill tree ids and competency ids are global, so prefix
  them with a short area tag (e.g. `life-`, `pe-`, `fa-`, `hl-`, `nat-`).
- `content/emergency-numbers.json` - `EmergencyNumber[]`, each with a source and `verified` flag.
- `content/careers.json` - `Career[]` grouped by career family (brief section 31).
- `content/languages/<code>.json` - `VocabPack` per study language (brief sections 18-19).

## Rules every item must follow

1. Age bands: every item lists at least one of `3-5`, `6-8`, `9-11`, `12-14`, `15-17`. Every area pack
   must have items for all five bands.
2. Levels 1-10 are learning levels, not ages (brief section 24).
3. Practical items (hands, body, tools, food, fire, water, electricity, animals, vehicles) need:
   - `safety` with `rating` green / amber / red, `hazards`, `notes` (brief section 38);
   - `versions.basic` (almost free), `versions.better` (low cost), `versions.advanced` (optional equipment);
   - at least one `substitutions` entry (brief section 37).
4. Projects, world projects and simulations need a safety rating; projects need versions and substitutions.
5. Sources: every `health` and `first-aid` item, every item with a `healthModule` and every amber or red
   item cites at least one source from a reputable public body (WHO, UNESCO, UNICEF, NHS, CDC, IFRC /
   Red Cross / Red Crescent, ILCOR-based resuscitation councils, RSPCA, national safety bodies, etc.).
   Use real, stable https URLs (organisation home or topic pages). Never invent deep links you are unsure
   of - prefer the organisation's topic page.
6. Health and puberty content: `healthModule` set, `reviewStatus: "awaiting-medical-review"`, factual,
   respectful, age-appropriate, no diagnosis, always "talk to a trusted adult / doctor" guidance.
7. First aid: separates knowledge from certified competency; practical first-aid items carry a
   `certificationNote` pointing to an accredited local course. Follows current Red Cross / ILCOR-style
   guidance (check scene safety first, call the emergency number, hands-only CPR awareness for learners,
   never attempt anything beyond training). "Do not become the second victim."
8. Animals: teach observation and safety. Never imply humans can talk with animals. Never teach
   provoking, cornering, chasing or dominating an animal.
9. Martial arts: fitness, discipline, defensive awareness, avoiding violence. Never street fighting.
10. Worldviews: comparative and neutral; describe what people of a tradition believe, never which is right.
11. Gender never limits learning: no item may say it is for girls or boys only, except gated health modules.
12. Low-cost principle: never assume laptops, labs, gardens, tutors or fast internet.
13. Tone: warm, short sentences, child-facing `summary` and `steps`; adult guidance goes in `adultNote`.
14. No brand names, no links to shops, no personal data, no images (emoji only).
