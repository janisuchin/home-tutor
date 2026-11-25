/**
 * AI tutor seam (owner decision 5). The owner has not chosen a provider yet, so no paid AI API is
 * called and no key exists. The route always answers "disabled"; the client hides the feature.
 * A future round implements the AiTutor interface in src/core/ai-tutor.ts behind this route.
 */
import type { Env } from './index';

export function aiTutorStub(env: Env): Response {
  const enabled = env.AI_TUTOR_ENABLED === 'true';
  return new Response(JSON.stringify({ enabled: false, error: enabled ? 'not_implemented' : 'ai_tutor_disabled' }), {
    status: 501,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
