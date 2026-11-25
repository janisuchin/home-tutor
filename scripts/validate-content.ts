/**
 * Content validator. Fails (exit code 1) on missing safety ratings, sources, age bands,
 * substitutions, project versions, broken references or duplicate ids.
 *
 * Run: npx tsx scripts/validate-content.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AREA_IDS,
  AGE_BANDS,
  COMPETENCY_GROUPS,
  SOURCE_REQUIRED_AREAS,
  type AreaPack,
  type ContentItem,
  type EmergencyNumber,
  type Career,
  type VocabPack,
  type Book,
  type Photo,
} from '../src/core/content-types';
import { ALLOWED_LICENCE, PHOTO_MAX_BYTES, PHOTO_MAX_WIDTH, THUMB_MAX_BYTES } from '../src/core/photos';
import { statSync } from 'node:fs';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

const SAFETY = ['green', 'amber', 'red'];
const KINDS = ['lesson', 'activity', 'simulation', 'project', 'world-project'];
const HEALTH_MODULES = ['body-basics', 'growing-up-girl', 'growing-up-boy', 'adolescent-health'];
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkSources(where: string, sources: unknown, errors: string[]) {
  if (!Array.isArray(sources) || sources.length === 0) {
    errors.push(`${where}: sources required`);
    return;
  }
  sources.forEach((s: any, i) => {
    if (!isNonEmptyString(s?.title) || !isNonEmptyString(s?.publisher) || !isNonEmptyString(s?.url))
      errors.push(`${where}: source ${i} needs title, publisher and url`);
    else if (!/^https:\/\//.test(s.url)) errors.push(`${where}: source ${i} url must start with https://`);
  });
}

export function validateItem(item: ContentItem, packArea: string, errors: string[], warnings: string[]) {
  const w = `item ${item?.id ?? '(no id)'}`;
  if (!isNonEmptyString(item.id) || !ID_RE.test(item.id)) errors.push(`${w}: id must be kebab-case`);
  if (!KINDS.includes(item.kind)) errors.push(`${w}: kind must be one of ${KINDS.join(', ')}`);
  if (item.area !== packArea) errors.push(`${w}: area "${item.area}" does not match pack "${packArea}"`);
  for (const f of ['subject', 'title', 'emoji', 'summary'] as const)
    if (!isNonEmptyString(item[f])) errors.push(`${w}: ${f} required`);
  if (!Array.isArray(item.ageBands) || item.ageBands.length === 0) errors.push(`${w}: ageBands required`);
  else for (const b of item.ageBands) if (!AGE_BANDS.includes(b)) errors.push(`${w}: unknown age band ${b}`);
  if (typeof item.level !== 'number' || item.level < 1 || item.level > 10) errors.push(`${w}: level must be 1-10`);
  if (typeof item.minutes !== 'number' || item.minutes <= 0) errors.push(`${w}: minutes must be > 0`);
  if (!Array.isArray(item.steps) || item.steps.length === 0) errors.push(`${w}: steps required`);
  if (typeof item.practical !== 'boolean') errors.push(`${w}: practical must be true or false`);
  if (!Array.isArray(item.competencies)) errors.push(`${w}: competencies must be an array`);
  if (!Array.isArray(item.skills)) errors.push(`${w}: skills must be an array`);
  if (!Array.isArray(item.interests)) errors.push(`${w}: interests must be an array`);

  const needsSafety = item.practical || item.kind === 'simulation' || item.kind === 'project' || item.kind === 'world-project';
  if (needsSafety) {
    if (!item.safety) errors.push(`${w}: safety rating required (practical/simulation/project)`);
    else {
      if (!SAFETY.includes(item.safety.rating)) errors.push(`${w}: safety.rating must be green, amber or red`);
      if (!Array.isArray(item.safety.hazards)) errors.push(`${w}: safety.hazards must be an array`);
      if (!isNonEmptyString(item.safety.notes)) errors.push(`${w}: safety.notes required`);
    }
  }
  const needsVersions = item.practical || item.kind === 'project' || item.kind === 'world-project';
  if (needsVersions) {
    if (!item.versions) errors.push(`${w}: Basic/Better/Advanced versions required`);
    else
      for (const v of ['basic', 'better', 'advanced'] as const) {
        const ver = item.versions[v];
        if (!ver || !isNonEmptyString(ver.cost) || !Array.isArray(ver.materials) || !isNonEmptyString(ver.description))
          errors.push(`${w}: versions.${v} needs cost, materials and description`);
      }
    if (!Array.isArray(item.substitutions) || item.substitutions.length === 0)
      errors.push(`${w}: at least one material substitution required`);
    else
      item.substitutions.forEach((s, i) => {
        if (!isNonEmptyString(s.instead) || !isNonEmptyString(s.use)) errors.push(`${w}: substitution ${i} needs instead and use`);
      });
  }
  const sourceRequired =
    SOURCE_REQUIRED_AREAS.includes(item.area) ||
    !!item.healthModule ||
    item.safety?.rating === 'amber' ||
    item.safety?.rating === 'red';
  if (sourceRequired) checkSources(w, item.sources, errors);
  else if (item.sources) checkSources(w, item.sources, errors);

  if (item.kind === 'simulation') {
    if (!item.simulation || !isNonEmptyString(item.simulation.scenario) || !Array.isArray(item.simulation.steps) || item.simulation.steps.length === 0)
      errors.push(`${w}: simulation needs scenario and steps`);
    else
      item.simulation.steps.forEach((s, i) => {
        if (!isNonEmptyString(s.prompt)) errors.push(`${w}: simulation step ${i} needs prompt`);
        if (!Array.isArray(s.options) || s.options.length < 2) errors.push(`${w}: simulation step ${i} needs 2+ options`);
        else if (!s.options.some((o) => o.correct)) errors.push(`${w}: simulation step ${i} needs a correct option`);
      });
  }
  if (item.check)
    item.check.forEach((q, i) => {
      if (!isNonEmptyString(q.question) || !Array.isArray(q.options) || q.options.length < 2)
        errors.push(`${w}: check ${i} needs question and 2+ options`);
      else if (!(q.answer >= 0 && q.answer < q.options.length)) errors.push(`${w}: check ${i} answer index out of range`);
    });
  if (item.healthModule) {
    if (!HEALTH_MODULES.includes(item.healthModule)) errors.push(`${w}: unknown healthModule ${item.healthModule}`);
    if (item.reviewStatus !== 'awaiting-medical-review' && item.reviewStatus !== 'reviewed')
      errors.push(`${w}: health content needs reviewStatus (awaiting-medical-review until signed off)`);
  }
  if (item.area === 'health' && !item.reviewStatus) errors.push(`${w}: health content needs reviewStatus`);
  if (item.area === 'first-aid' && item.practical && !isNonEmptyString(item.certificationNote))
    errors.push(`${w}: practical first aid needs a certificationNote (knowledge is not certified competency)`);
  if (item.safety?.rating === 'red' && !isNonEmptyString(item.certificationNote) && !isNonEmptyString(item.adultNote))
    warnings.push(`${w}: red items should explain the professional supervision needed (certificationNote or adultNote)`);
}

export function validateAll(root: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};
  const areasDir = join(root, 'content', 'areas');
  const packs: AreaPack[] = [];
  for (const area of AREA_IDS) {
    const f = join(areasDir, `${area}.json`);
    if (!existsSync(f)) {
      errors.push(`missing content pack content/areas/${area}.json`);
      continue;
    }
    try {
      packs.push(JSON.parse(readFileSync(f, 'utf8')));
    } catch (e) {
      errors.push(`content/areas/${area}.json is not valid JSON: ${(e as Error).message}`);
    }
  }
  for (const f of readdirSync(areasDir))
    if (!AREA_IDS.includes(f.replace(/\.json$/, '') as any)) errors.push(`unexpected file content/areas/${f}`);

  const itemIds = new Set<string>();
  const compIds = new Set<string>();
  const trees = new Map<string, Set<string>>();
  const allItems: ContentItem[] = [];

  for (const pack of packs) {
    const p = `pack ${pack.area}`;
    if (!isNonEmptyString(pack.title) || !isNonEmptyString(pack.emoji) || !isNonEmptyString(pack.description))
      errors.push(`${p}: title, emoji, description required`);
    for (const t of pack.skillTrees ?? []) {
      if (trees.has(t.id)) errors.push(`${p}: duplicate skill tree ${t.id}`);
      if (!Array.isArray(t.nodes) || t.nodes.length < 2) errors.push(`${p}: skill tree ${t.id} needs 2+ nodes`);
      trees.set(t.id, new Set((t.nodes ?? []).map((n) => n.id)));
    }
    for (const c of pack.competencies ?? []) {
      if (compIds.has(c.id)) errors.push(`${p}: duplicate competency ${c.id}`);
      if (!COMPETENCY_GROUPS.includes(c.group)) errors.push(`${p}: competency ${c.id} has unknown group ${c.group}`);
      if (!isNonEmptyString(c.title)) errors.push(`${p}: competency ${c.id} needs a title`);
      compIds.add(c.id);
    }
    for (const item of pack.items ?? []) {
      if (itemIds.has(item.id)) errors.push(`duplicate item id ${item.id}`);
      itemIds.add(item.id);
      validateItem(item, pack.area, errors, warnings);
      allItems.push(item);
    }
    // coverage: every area must serve every age band
    for (const band of AGE_BANDS) {
      const n = (pack.items ?? []).filter((i) => i.ageBands?.includes(band)).length;
      if (n === 0) errors.push(`${p}: no items for age band ${band}`);
    }
  }
  for (const item of allItems) {
    for (const c of item.competencies ?? []) if (!compIds.has(c)) errors.push(`item ${item.id}: unknown competency ${c}`);
    for (const s of item.skills ?? []) {
      const t = trees.get(s.tree);
      if (!t) errors.push(`item ${item.id}: unknown skill tree ${s.tree}`);
      else if (!t.has(s.node)) errors.push(`item ${item.id}: unknown node ${s.node} in tree ${s.tree}`);
    }
  }
  for (const pack of packs)
    for (const pw of pack.pathways ?? []) {
      if (!Array.isArray(pw.steps) || pw.steps.length < 3) errors.push(`pathway ${pw.id}: needs 3+ steps`);
      for (const s of pw.steps ?? []) for (const id of s.itemIds ?? []) if (!itemIds.has(id)) errors.push(`pathway ${pw.id}: unknown item ${id}`);
    }

  // Emergency numbers
  const enFile = join(root, 'content', 'emergency-numbers.json');
  if (!existsSync(enFile)) errors.push('missing content/emergency-numbers.json');
  else {
    const list: EmergencyNumber[] = JSON.parse(readFileSync(enFile, 'utf8'));
    for (const e of list) {
      if (!/^[A-Z]{2}$/.test(e.countryCode)) errors.push(`emergency ${e.country}: bad countryCode`);
      if (!e.general && !e.ambulance) errors.push(`emergency ${e.countryCode}: needs general or ambulance number`);
      if (typeof e.verified !== 'boolean') errors.push(`emergency ${e.countryCode}: verified must be true/false`);
      checkSources(`emergency ${e.countryCode}`, [e.source], errors);
    }
    stats.emergencyCountries = list.length;
  }
  const careersFile = join(root, 'content', 'careers.json');
  if (existsSync(careersFile)) {
    const careers: Career[] = JSON.parse(readFileSync(careersFile, 'utf8'));
    stats.careers = careers.length;
    for (const c of careers) if (!c.ageBands?.length) errors.push(`career ${c.id}: ageBands required`);
  } else errors.push('missing content/careers.json');

  const langDir = join(root, 'content', 'languages');
  if (existsSync(langDir)) {
    const files = readdirSync(langDir).filter((f) => f.endsWith('.json'));
    stats.studyLanguages = files.length;
    for (const f of files) {
      const v: VocabPack = JSON.parse(readFileSync(join(langDir, f), 'utf8'));
      if (!v.language || !v.ttsLang || !v.concepts) errors.push(`language ${f}: language, ttsLang and concepts required`);
    }
  } else errors.push('missing content/languages/');

  // Photos (D-052): every photo credited, openly licensed, self-hosted and small.
  const pathwayIds = new Set<string>();
  for (const a of AREA_IDS) {
    const f = join(root, 'content', 'areas', `${a}.json`);
    if (existsSync(f)) for (const pw of (JSON.parse(readFileSync(f, 'utf8')) as AreaPack).pathways ?? []) pathwayIds.add(pw.id);
  }
  const careerIds = new Set<string>(existsSync(careersFile) ? (JSON.parse(readFileSync(careersFile, 'utf8')) as Career[]).map((c) => c.id) : []);
  const healthOnly = new Set(allItems.filter((i) => i.healthModule).map((i) => i.id));
  const photosFile = join(root, 'content', 'photos.json');
  const photos: Photo[] = existsSync(photosFile) ? JSON.parse(readFileSync(photosFile, 'utf8')) : [];
  const photoIds = new Set<string>();
  for (const p of photos) errors.push(...validatePhoto(p, root, { itemIds, trees, pathwayIds, careerIds, healthOnly }));
  for (const p of photos) {
    if (photoIds.has(p.id)) errors.push(`photo ${p.id}: duplicate id`);
    photoIds.add(p.id);
  }
  stats.photos = photos.length;

  // Books (D-053): real books only, each with a library verification key, an age band and a type.
  const booksFile = join(root, 'content', 'books.json');
  const books: Book[] = existsSync(booksFile) ? JSON.parse(readFileSync(booksFile, 'utf8')) : [];
  const bookIds = new Set<string>();
  const workKeys = new Set<string>();
  for (const b of books) {
    errors.push(...validateBook(b));
    if (bookIds.has(b.id)) errors.push(`book ${b.id}: duplicate id`);
    if (b.verify?.workKey && workKeys.has(b.verify.workKey + b.band)) errors.push(`book ${b.id}: duplicate work in band`);
    bookIds.add(b.id);
    if (b.verify?.workKey) workKeys.add(b.verify.workKey + b.band);
  }
  stats.books = books.length;

  stats.items = allItems.length;
  stats.practical = allItems.filter((i) => i.practical).length;
  stats.simulations = allItems.filter((i) => i.kind === 'simulation').length;
  stats.projects = allItems.filter((i) => i.kind === 'project' || i.kind === 'world-project').length;
  stats.skillTrees = trees.size;
  stats.competencies = compIds.size;
  return { errors, warnings, stats };
}

export function validatePhoto(
  p: Photo,
  root: string,
  ref: { itemIds: Set<string>; trees: Map<string, unknown>; pathwayIds: Set<string>; careerIds: Set<string>; healthOnly: Set<string> },
): string[] {
  const e: string[] = [];
  const w = `photo ${p.id}`;
  if (!ID_RE.test(p.id ?? '')) e.push(`${w}: id must be kebab-case`);
  if (!isNonEmptyString(p.alt) || p.alt.length < 8) e.push(`${w}: alt text required`);
  if (!isNonEmptyString(p.title)) e.push(`${w}: title required`);
  const c = p.credit;
  if (!c) e.push(`${w}: no credit`);
  else {
    for (const k of ['title', 'author', 'sourceUrl', 'licence', 'licenceUrl', 'provider', 'changes'] as const) if (!isNonEmptyString(c[k])) e.push(`${w}: credit.${k} required`);
    if (isNonEmptyString(c.licence) && !ALLOWED_LICENCE.test(c.licence)) e.push(`${w}: licence not allowed (${c.licence}); only CC0, public domain, CC BY, CC BY-SA`);
    if (isNonEmptyString(c.sourceUrl) && !/^https:\/\//.test(c.sourceUrl)) e.push(`${w}: sourceUrl must be https`);
    if (isNonEmptyString(c.licenceUrl) && !/^https?:\/\//.test(c.licenceUrl)) e.push(`${w}: licenceUrl must be a URL`);
    if (/\b(nc|nd)\b/i.test(c.licence ?? '') || /-(nc|nd)/i.test(c.licenceUrl ?? '')) e.push(`${w}: NC/ND licences are not allowed`);
  }
  if (!(p.width > 0 && p.width <= PHOTO_MAX_WIDTH)) e.push(`${w}: width must be 1-${PHOTO_MAX_WIDTH}`);
  for (const [file, max] of [[`${p.id}.webp`, PHOTO_MAX_BYTES], [`${p.id}-thumb.webp`, THUMB_MAX_BYTES]] as const) {
    const f = join(root, 'public', 'photos', file);
    if (!existsSync(f)) e.push(`${w}: missing file public/photos/${file}`);
    else if (statSync(f).size > max) e.push(`${w}: ${file} is ${statSync(f).size} bytes (limit ${max})`);
  }
  if (!Array.isArray(p.links) || !p.links.length) e.push(`${w}: links required`);
  for (const id of p.links ?? []) {
    if (!ref.itemIds.has(id) && !ref.trees.has(id) && !ref.pathwayIds.has(id) && !ref.careerIds.has(id)) e.push(`${w}: unknown link ${id}`);
    if (ref.healthOnly.has(id)) e.push(`${w}: health lessons use diagrams, not photos (${id})`);
  }
  if (!Array.isArray(p.areas) || !p.areas.length || p.areas.some((a) => !(AREA_IDS as readonly string[]).includes(a))) e.push(`${w}: areas invalid`);
  return e;
}

export function validateBook(b: Book): string[] {
  const e: string[] = [];
  const w = `book ${b.id}`;
  if (!ID_RE.test(b.id ?? '')) e.push(`${w}: id must be kebab-case`);
  for (const k of ['title', 'author', 'genre', 'why'] as const) if (!isNonEmptyString(b[k])) e.push(`${w}: ${k} required`);
  if (!Number.isInteger(b.year) || b.year < 1 || b.year > 2026) e.push(`${w}: year invalid`);
  if (!(AGE_BANDS as readonly string[]).includes(b.band)) e.push(`${w}: age band required`);
  if (b.type !== 'fiction' && b.type !== 'non-fiction') e.push(`${w}: type must be fiction or non-fiction`);
  if (b.verify?.source !== 'openlibrary' || !/^\/works\/OL\d+W$/.test(b.verify?.workKey ?? '')) e.push(`${w}: verification key (Open Library work key) required`);
  if (!Array.isArray(b.areas) || !b.areas.length || b.areas.some((a) => !(AREA_IDS as readonly string[]).includes(a))) e.push(`${w}: areas invalid`);
  if (!Array.isArray(b.interests)) e.push(`${w}: interests required`);
  if (b.freeRead) {
    if (!/^https:\/\/(www\.gutenberg\.org|standardebooks\.org|storyweaver\.org\.in)\//.test(b.freeRead.url)) e.push(`${w}: freeRead must be Project Gutenberg, Standard Ebooks or StoryWeaver`);
    if (!isNonEmptyString(b.freeRead.licence)) e.push(`${w}: freeRead licence required`);
  }
  return e;
}

const isMain = process.argv[1] && /validate-content\.ts$/.test(process.argv[1]);
if (isMain) {
  const root = join(__dirname, '..');
  const { errors, warnings, stats } = validateAll(root);
  for (const w of warnings) console.warn('warn:', w);
  for (const e of errors) console.error('error:', e);
  console.log('content stats:', JSON.stringify(stats));
  if (errors.length) {
    console.error(`\nContent validation FAILED with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log('Content validation passed.');
}
