import { existsSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getMcpAssetPaths,
  getMcpBuildInfo,
  MCP_ASSET_DIRECTORY,
} from "../assets.js";

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

describe("getMcpBuildInfo", () => {
  it("is a function", () => {
    expect(typeof getMcpBuildInfo).toBe("function");
  });

  it("accepts zero params and returns commit, version, and versionString", () => {
    const buildInfo = getMcpBuildInfo();
    expect(typeof buildInfo.commit).toBe("string");
    expect(typeof buildInfo.version).toBe("string");
    expect(typeof buildInfo.versionString).toBe("string");
  });

  it("falls back to an unbuilt version without a commit", () => {
    expect(getMcpBuildInfo()).toEqual({
      commit: "",
      version: "0.0.0",
      versionString: "@jaypie/mcp@0.0.0",
    });
  });

  it("returns a new object on each call", () => {
    expect(getMcpBuildInfo()).not.toBe(getMcpBuildInfo());
  });
});
