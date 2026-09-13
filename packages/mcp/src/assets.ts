// Locate the markdown that ships inside @jaypie/mcp, for build scripts that bundle it

import * as path from "node:path";
import { fileURLToPath } from "node:url";

//
//
// Constants
//

export const MCP_ASSET_DIRECTORY = {
  RELEASE_NOTES: "release-notes",
  SKILLS: "skills",
} as const;

//
//
// Types
//

export interface McpAssetPaths {
  /** Absolute path of the release notes directory read by `release_notes` */
  releaseNotes: string;
  /** Absolute path of the Jaypie skills directory read by `skill` */
  skills: string;
}

//
//
// Main
//

/**
 * Absolute paths of the markdown directories `skill` and `release_notes` read
 * at runtime
 *
 * A bundler (esbuild) inlines the code but not the markdown. Copy each
 * directory beside the bundle under its own name (`skills/`,
 * `release-notes/`) and the docs suite finds it without configuration. Call
 * this from a build script, never from bundled code.
 *
 * @example
 * ```typescript
 * import { cpSync } from "node:fs";
 * import { join } from "node:path";
 * import { getMcpAssetPaths, MCP_ASSET_DIRECTORY } from "@jaypie/mcp/assets";
 *
 * const assets = getMcpAssetPaths();
 * cpSync(assets.skills, join("dist", MCP_ASSET_DIRECTORY.SKILLS), { recursive: true });
 * cpSync(assets.releaseNotes, join("dist", MCP_ASSET_DIRECTORY.RELEASE_NOTES), { recursive: true });
 * ```
 */
export function getMcpAssetPaths(): McpAssetPaths {
  // src/assets.ts and dist/assets.js both sit one level below the package root
  const packageRoot = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  return {
    releaseNotes: path.join(packageRoot, MCP_ASSET_DIRECTORY.RELEASE_NOTES),
    skills: path.join(packageRoot, MCP_ASSET_DIRECTORY.SKILLS),
  };
}
