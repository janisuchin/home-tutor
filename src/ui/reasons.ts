import type { Recommendation } from '../core/engine/recommend';

export function reasonText(t: (k: string, v?: any) => string, r: Recommendation, max = 2) {
  return r.reasons
    .slice(0, max)
    .map((x) => t(x.key, x.vars))
    .join(' · ');
}
