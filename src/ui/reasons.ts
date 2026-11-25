import type { Reason } from '../core/engine/recommend';

export function reasonText(t: (k: string, v?: any) => string, r: { reasons: Reason[] }, max = 2) {
  return r.reasons
    .slice(0, max)
    .map((x) => t(x.key, x.vars))
    .join(' · ');
}
