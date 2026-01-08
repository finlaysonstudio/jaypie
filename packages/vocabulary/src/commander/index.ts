// @jaypie/vocabulary/commander
// Commander.js adapter utilities

export { createCommanderOptions } from "./createCommanderOptions.js";
export { parseCommanderOptions } from "./parseCommanderOptions.js";
export { registerServiceCommand } from "./registerServiceCommand.js";

export type {
  CommanderOptionOverride,
  CreateCommanderOptionsConfig,
  CreateCommanderOptionsResult,
  OnCompleteCallback,
  OnErrorCallback,
  OnMessageCallback,
  ParseCommanderOptionsConfig,
  RegisterServiceCommandConfig,
  RegisterServiceCommandResult,
} from "./types.js";
