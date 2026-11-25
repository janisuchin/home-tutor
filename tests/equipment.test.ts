import { describe, expect, it } from 'vitest';
import { catalog, child, family, NOW } from './helpers';
import { availableEquipment, equipmentFit, itemNeeds } from '../src/core/engine/equipment';
import { recommend } from '../src/core/engine/recommend';

describe('family equipment inventory', () => {
  const cat = catalog();
  const bikeItem = cat.items.find((i) => i.practical && itemNeeds(i).includes('bicycle') && i.ageBands.includes('9-11'))!;
  const kid = child({ birth: '2015-06', equipment: [] }); // 11
  it('guesses what practical items need', () => {
    expect(bikeItem).toBeTruthy();
    expect(itemNeeds({ subject: 'cooking', interests: [], practical: true })).toEqual(['kitchen']);
    expect(itemNeeds({ subject: 'cooking', interests: [], practical: false })).toEqual([]);
  });
  it('merges the family inventory with the child’s own things', () => {
    expect([...availableEquipment(child({ equipment: ['tablet'] }), family({ equipment: ['bicycle'] }))].sort()).toEqual(['bicycle', 'tablet']);
  });
  it('assumes nothing until the family fills in the inventory', () => {
    expect(equipmentFit(bikeItem, kid, family())).toBeUndefined();
    expect(equipmentFit(bikeItem, kid, family({ equipment: ['phone'] }))!.missing).toContain('bicycle');
  });
  it('moves items up when the family has the gear and down when it does not, never hiding them', () => {
    const rank = (eq: any[]) => {
      const recs = recommend(kid, family({ equipment: eq }), cat, [], { now: NOW });
      return { i: recs.findIndex((r) => r.item.id === bikeItem.id), r: recs.find((r) => r.item.id === bikeItem.id)! };
    };
    const without = rank(['phone']);
    const withBike = rank(['phone', 'bicycle']);
    expect(without.i).toBeGreaterThanOrEqual(0);
    expect(withBike.i).toBeLessThan(without.i);
    expect(withBike.r.reasons.map((x) => x.key)).toContain('reason.equipment');
    expect(withBike.r.score - without.r.score).toBe(3);
  });
});
