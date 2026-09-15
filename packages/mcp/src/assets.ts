// Locate the markdown that ships inside @jaypie/mcp, and the build that packed it,
// for build scripts that bundle it

import * as path from "node:path";
import { fileURLToPath } from "node:url";

//
//
// Build-time constants (replaced by @rollup/plugin-replace)
//

declare const __BUILD_COMMIT__: string;
declare const __BUILD_VERSION__: string;
declare const __BUILD_VERSION_STRING__: string;

//
//
// Constants
//

const UNBUILT_COMMIT = "";
const UNBUILT_VERSION = "0.0.0";
const UNBUILT_VERSION_STRING = `@jaypie/mcp@${UNBUILT_VERSION}`;

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

export interface McpBuildInfo {
  /** First 8 characters of `PROJECT_COMMIT` at build time; empty when unset */
  commit: string;
  /** `package.json` version at build time */
  version: string;
  /** `@jaypie/mcp@<version>#<commit>`, the string `version` answers */
  versionString: string;
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

/**
 * Version and commit of the `@jaypie/mcp` build, compiled in at build time
 *
 * A consumer syncing `skills/` and `release-notes/` reads the build that
 * packed them from the same package. Unbuilt source (tests, `tsx`) returns
 * version `0.0.0` and an empty commit.
 *
 * @example
 * ```typescript
 * import { getMcpBuildInfo } from "@jaypie/mcp/assets";
 *
 * const { commit, version, versionString } = getMcpBuildInfo();
 * ```
 */
export function getMcpBuildInfo(): McpBuildInfo {
  return {
    commit:
      typeof __BUILD_COMMIT__ !== "undefined"
        ? __BUILD_COMMIT__
        : UNBUILT_COMMIT,
    version:
      typeof __BUILD_VERSION__ !== "undefined"
        ? __BUILD_VERSION__
        : UNBUILT_VERSION,
    versionString:
      typeof __BUILD_VERSION_STRING__ !== "undefined"
        ? __BUILD_VERSION_STRING__
        : UNBUILT_VERSION_STRING,
  };
}
