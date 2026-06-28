import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { satisfies } from "semver";
import { describe, expect, it } from "vitest";

//
//
// Constants
//

// The version of @jaypie/errors that introduced ConflictError, which
// entities.ts imports. Installs that resolve an older @jaypie/errors fail to
// bundle ("No matching export ... for import ConflictError"). See issue #400.
const CONFLICT_ERROR_FLOOR = "1.2.3";
const PRE_CONFLICT_ERROR = "1.2.1";

const packageJson = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
    "utf8",
  ),
);

//
//
// Run tests
//

describe("@jaypie/dynamodb dependency floors", () => {
  it("imports ConflictError from @jaypie/errors", () => {
    const entities = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../entities.ts"),
      "utf8",
    );
    expect(entities).toContain("ConflictError");
    expect(entities).toContain('from "@jaypie/errors"');
  });

  it("declares an @jaypie/errors peer that requires ConflictError support", () => {
    const range = packageJson.peerDependencies?.["@jaypie/errors"];
    expect(range).toBeString();
    // A floorless "*" satisfies the pre-ConflictError 1.2.1, which breaks bundling
    expect(satisfies(PRE_CONFLICT_ERROR, range)).toBe(false);
    expect(satisfies(CONFLICT_ERROR_FLOOR, range)).toBe(true);
  });
});
