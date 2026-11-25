/**
 * AI tutor interface (owner decision 5): the seam only. The feature flag is OFF and hidden
 * (FamilySettings.aiTutor is typed `false`), there is no provider and no API key.
 * The v1 what-next engine is rule-based and offline (src/core/engine/recommend.ts).
 */
export interface AiTutorRequest {
  childAgeBand: string;
  question: string;
  /** Never include names, contact details or health notes. */
  context?: { subject?: string; itemId?: string; level?: number };
}

export interface AiTutorReply {
  answer: string;
  safetyFlags: string[];
}

export interface AiTutor {
  readonly enabled: boolean;
  ask(req: AiTutorRequest): Promise<AiTutorReply>;
}

export const AI_TUTOR_FEATURE_FLAG = false as const;

/** The only implementation in v1: always disabled. */
export const disabledAiTutor: AiTutor = {
  enabled: false,
  async ask() {
    throw new Error('ai_tutor_disabled');
  },
};
