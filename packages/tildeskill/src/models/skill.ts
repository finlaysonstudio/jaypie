import {
  fabricIndex,
  isModelRegistered,
  type ModelSchema,
  registerModel,
} from "@jaypie/fabric";

export const SKILL_MODEL_NAME = "skill";

/**
 * Registration schema for the `skill` model. The DynamoDB store lists a
 * category through `indexModelCategory`, so tables serving skills must declare
 * that index.
 */
export const SKILL_MODEL: ModelSchema = {
  indexes: [fabricIndex("category")],
  model: SKILL_MODEL_NAME,
};

/**
 * Idempotently register the `skill` model. An existing registration (for
 * example, one an application made with additional indexes) is left in place.
 */
export function registerSkillModel(): void {
  if (isModelRegistered(SKILL_MODEL_NAME)) {
    return;
  }
  registerModel(SKILL_MODEL);
}
