import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extendDatadogRole } from "..";

// https://github.com/finlaysonstudio/jaypie/issues/390
//
// `extendDatadogRole` was present in the runtime bundle but vanished from the
// public `.d.ts` under node16/nodenext module resolution. The per-file
// declaration tree used extensionless relative specifiers (`from "./helpers"`),
// which ESM-mode resolution cannot follow, so `export * from "./helpers"`
// resolved to zero members (TS2305) and every named re-export silently
// degraded to `any`. The build now bundles the declarations into a single,
// self-contained `index.d.ts` so every export resolves under all resolution
// modes.

const distFile = (relative: string): string =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));

describe("issue-390 declaration types", () => {
  describe("Runtime", () => {
    it("exports extendDatadogRole", () => {
      expect(typeof extendDatadogRole).toBe("function");
    });
  });

  describe.each([["dist/esm/index.d.ts"], ["dist/cjs/index.d.cts"]])(
    "Bundled declarations: %s",
    (relative) => {
      const path = distFile(relative);

      it("is built (run `npm run build -w packages/constructs` first)", () => {
        expect(existsSync(path)).toBe(true);
      });

      it("is self-contained with no relative re-exports", () => {
        const source = readFileSync(path, "utf8");
        // A relative specifier in the public declaration file means a consumer
        // under node16/nodenext would fail to resolve it (the cause of #390).
        expect(source).not.toMatch(/from\s+["']\.\.?\//);
      });

      it("re-exports extendDatadogRole and ExtendDatadogRoleOptions", () => {
        const source = readFileSync(path, "utf8");
        expect(source).toContain("extendDatadogRole");
        expect(source).toContain("ExtendDatadogRoleOptions");
      });
    },
  );
});
