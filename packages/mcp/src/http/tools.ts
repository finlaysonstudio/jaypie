import { selectServiceFunctions } from "@jaypie/fabric";
import type { Service, ServiceSuite } from "@jaypie/fabric";

//
//
// Types
//

export interface SelectToolsOptions {
  /** Allowlist of service aliases. Omit to select every service */
  services?: string[];
  suite: ServiceSuite;
}

//
//
// Main
//

/**
 * Select the services a suite exposes as MCP tools
 *
 * Delegates to `selectServiceFunctions` from `@jaypie/fabric`, the same
 * selection `createMcpServerFromSuite` applies, so every transport narrows
 * tools identically.
 */
export function selectTools({
  services,
  suite,
}: SelectToolsOptions): Service[] {
  return selectServiceFunctions(suite, { services });
}

/** Find one exposed tool by name; tools outside the allowlist are absent */
export function findTool(
  name: string,
  options: SelectToolsOptions,
): Service | undefined {
  return selectTools(options).find((tool) => tool.alias === name);
}
