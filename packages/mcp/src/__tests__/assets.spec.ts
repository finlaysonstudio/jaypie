import { existsSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { getMcpAssetPaths, MCP_ASSET_DIRECTORY } from "../assets.js";

//
//
// Run tests
//

describe("getMcpAssetPaths", () => {
  it("is a function", () => {
    expect(typeof getMcpAssetPaths).toBe("function");
  });

  it("returns absolute paths named for each asset directory", () => {
    const assets = getMcpAssetPaths();
    expect(path.isAbsolute(assets.releaseNotes)).toBe(true);
    expect(path.isAbsolute(assets.skills)).toBe(true);
    expect(path.basename(assets.releaseNotes)).toBe(
      MCP_ASSET_DIRECTORY.RELEASE_NOTES,
    );
    expect(path.basename(assets.skills)).toBe(MCP_ASSET_DIRECTORY.SKILLS);
  });

  it("points at directories that exist in the package", () => {
    const assets = getMcpAssetPaths();
    expect(existsSync(path.join(assets.releaseNotes, "mcp"))).toBe(true);
    expect(existsSync(path.join(assets.skills, "mcp.md"))).toBe(true);
  });
});
