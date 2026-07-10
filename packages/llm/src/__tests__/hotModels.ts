import { MODEL } from "../constants.js";

//
// Model sets for the live provider "hot" tests
// (`src/providers/*/__tests__/client.hot.spec.ts`).
//
// Each hot test traverses its provider's list below instead of pinning a single
// model, so a new id is covered the moment it lands in MODEL. Every id is a
// non-deprecated MODEL.* member; OpenRouter walks the MODEL.OPENROUTER subtree.
//

/**
 * Models to skip in live hot tests — not yet launched, unavailable on typical
 * keys, or too costly to exercise on every keyed run. Add ids here to drop them
 * from the traversals below without editing each spec.
 */
export const HOT_EXCLUDE = new Set<string>([MODEL.MYTHOS]);

const exclude = (models: string[]): string[] =>
  models.filter((model) => !HOT_EXCLUDE.has(model));

export const HOT_MODELS = {
  anthropic: exclude([
    MODEL.FABLE,
    MODEL.HAIKU,
    MODEL.MYTHOS,
    MODEL.OPUS,
    MODEL.SONNET,
  ]),
  google: exclude([
    MODEL.GEMINI_FLASH,
    MODEL.GEMINI_FLASH_LITE,
    MODEL.GEMINI_PRO,
  ]),
  openai: exclude([MODEL.LUNA, MODEL.SOL, MODEL.TERRA]),
  openrouter: exclude(Object.values(MODEL.OPENROUTER)),
  xai: exclude([MODEL.GROK]),
} as const;
