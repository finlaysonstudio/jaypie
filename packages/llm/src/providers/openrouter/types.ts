import { LlmMessageRole } from "../../types/LlmProvider.interface.js";
import { PROVIDER } from "../../constants.js";

// Maps Jaypie roles to Anthropic roles
export const ROLE_MAP: Record<LlmMessageRole, string> = {
  [LlmMessageRole.User]: PROVIDER.ANTHROPIC.ROLE.USER,
  [LlmMessageRole.System]: PROVIDER.ANTHROPIC.ROLE.SYSTEM,
  [LlmMessageRole.Assistant]: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
  [LlmMessageRole.Developer]: PROVIDER.ANTHROPIC.ROLE.SYSTEM,
};
