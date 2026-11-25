/**
 * Review edition only (D-051): Browse everything (filter by area, age band, safety rating and type)
 * and View as (what a child of a given age, or a mixed group, gets in the normal edition).
 * English only: this is the owner's checking tool, not a family screen.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Choice, Field, Notice, Pill, Row, SafetyBadge, Screen, Section, Txt } from '../ui/kit';
import { colors } from '../ui/theme';
import { useCatalog, useChildren } from '../data/hooks';
import { useAppState, saveChild, getState } from '../data/store';
import { loadBooks, loadCareers } from '../content/loader';
import { isUnlocked } from '../core/edition';
import { AGE_BANDS, AREA_IDS, type AgeBand, type AreaId, type Career, type SafetyRating } from '../core/content-types';
import { allEntries, ENTRY_TYPES, filterEntries, viewAs, viewAsChildren, type BookLike, type EntryType, type ViewAsGroup } from '../core/engine/review';

const PAGE = 60;

export default function Review() {
  const catalog = useCatalog();
  const family = useAppState((s) => s.family);
  const children = useChildren();
  const [careers, setCareers] = useState<Career[]>([]);
  const [books, setBooks] = useState<BookLike[]>([]);
  useEffect(() => {
    loadCareers().then(setCareers).catch(() => {});
    loadBooks().then(setBooks).catch(() => {});
  }, []);

  // View as
  const [age, setAge] = useState(8);
  const [group, setGroup] = useState<ViewAsGroup>('girl');
  const [health, setHealth] = useState<'off' | 'on'>('off');
  const learners = useMemo(() => viewAsChildren(age, group, health === 'on'), [age, group, health]);
  const result = useMemo(() => (catalog ? viewAs(catalog, learners, family) : undefined), [catalog, learners, family]);

  // Browse everything
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [band, setBand] = useState<AgeBand | 'all'>('all');
  const [rating, setRating] = useState<SafetyRating | 'none' | 'all'>('all');
  const [type, setType] = useState<EntryType | 'all'>('all');
  const [text, setText] = useState('');
  const [shown, setShown] = useState(PAGE);
  const entries = useMemo(() => (catalog ? allEntries(catalog, careers, books) : []), [catalog, careers, books]);
  const filtered = useMemo(
    () => filterEntries(entries, { area: area === 'all' ? undefined : area, band: band === 'all' ? undefined : band, rating: rating === 'all' ? undefined : rating, type: type === 'all' ? undefined : type, text }),
    [entries, area, band, rating, type, text],
  );
  useEffect(() => setShown(PAGE), [area, band, rating, type, text]);

  if (!isUnlocked()) {
    return (
      <Screen title="Review">
        <Notice text="This page is only in the review edition." />
      </Screen>
    );
  }
  const reviewer = children.find((c) => !c.id.startsWith('viewas-')) ?? children[0];
  const openAs = () => {
    const c = learners[0];
    const fam = getState().family;
    if (fam) saveChild({ ...c, familyId: fam.id });
    router.push(`/learn/${c.id}`);
  };
  const open = (path?: string) => {
    if (!path || !reviewer) return;
    router.push(`/learn/${reviewer.id}/${path}`);
  };
  const opt = <T extends string>(v: T, label?: string) => ({ value: v, label: label ?? v });

  return (
    <Screen title="Review: everything" testID="review-screen">
      <Notice icon="🔓" text="Review edition. Everything is open here, including the health and puberty pathways (still labelled Awaiting review by a medical professional). No parent PIN. The AI tutor is off. Data stays in this review edition's own database." />

      <Section title="View as" testID="view-as">
        <Txt variant="small">What a child gets in the normal edition: the normal age, health and worldview gates apply here.</Txt>
        <Choice testID="viewas-age" value={String(age)} onChange={(v) => setAge(Number(v))} options={Array.from({ length: 15 }, (_, i) => opt(String(i + 3)))} />
        <Choice testID="viewas-group" value={group} onChange={setGroup} options={[opt('girl', 'Girl'), opt('boy', 'Boy'), opt('mixed', 'Mixed group')]} />
        <Choice testID="viewas-health" value={health} onChange={setHealth} options={[opt('off', 'Health lessons off (default)'), opt('on', 'Parent switched health lessons on')]} />
        {result ? (
          <Card>
            <Txt variant="h3" testID="viewas-summary">
              {group === 'mixed' ? `Mixed group, age ${age}` : `${group === 'girl' ? 'Girl' : 'Boy'}, age ${age}`}: {result.visible.length} items, {result.healthItems} health items
            </Txt>
            <Row wrap>
              {AREA_IDS.filter((a) => result.perArea[a]).map((a) => (
                <Pill key={a} text={`${a} ${result.perArea[a]}`} />
              ))}
            </Row>
            <Txt variant="small">Today's plan:</Txt>
            {result.plan.map((r) => (
              <Txt key={r.item.id} testID={`viewas-plan-${r.item.id}`}>
                {r.item.emoji} {r.item.title} ({r.item.area}, {r.item.minutes} min)
              </Txt>
            ))}
            {group !== 'mixed' ? <Button testID="viewas-open" label="Open the child home as this child" icon="👀" onPress={openAs} /> : <Txt variant="small">A mixed group shares only items every member may do; health lessons are never shared.</Txt>}
          </Card>
        ) : null}
      </Section>

      <Section title="Browse everything" testID="browse">
        <Field label="Search" value={text} onChangeText={setText} testID="browse-search" />
        <Txt variant="small">Area</Txt>
        <Choice testID="browse-area" value={area} onChange={setArea} options={[opt('all' as const, 'All'), ...AREA_IDS.map((a) => opt(a))]} />
        <Txt variant="small">Age band</Txt>
        <Choice testID="browse-band" value={band} onChange={setBand} options={[opt('all' as const, 'All'), ...AGE_BANDS.map((b) => opt(b))]} />
        <Txt variant="small">Safety rating</Txt>
        <Choice testID="browse-rating" value={rating} onChange={setRating} options={[opt('all' as const, 'All'), opt('green' as const, 'Green'), opt('amber' as const, 'Amber'), opt('red' as const, 'Red'), opt('none' as const, 'No rating')]} />
        <Txt variant="small">Type</Txt>
        <Choice testID="browse-type" value={type} onChange={setType} options={[opt('all' as const, 'All'), ...ENTRY_TYPES.map((x) => opt(x))]} />
        <Txt testID="browse-count" variant="h3">
          {filtered.length} of {entries.length}
        </Txt>
        {filtered.slice(0, shown).map((e) => (
          <Card key={`${e.type}:${e.id}`} onPress={e.open ? () => open(e.open) : undefined} testID={`entry-${e.type}-${e.id}`}>
            <Row wrap>
              <Txt variant="h3">
                {e.emoji} {e.title}
              </Txt>
              <Pill text={e.type} />
              <Pill text={e.area} bg={colors.surfaceAlt} />
              {e.ageBands.length ? <Pill text={e.ageBands.join(', ')} /> : null}
              {e.rating ? <SafetyBadge rating={e.rating} /> : null}
              {e.healthModule ? <Pill text={`health: ${e.healthModule}`} /> : null}
            </Row>
          </Card>
        ))}
        {filtered.length > shown ? <Button testID="browse-more" variant="ghost" label={`Show more (${filtered.length - shown} left)`} onPress={() => setShown(shown + PAGE)} /> : null}
      </Section>
    </Screen>
  );
}
