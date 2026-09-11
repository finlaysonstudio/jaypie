import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const PACKAGE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const PACKAGE_JSON = resolve(PACKAGE_DIR, "package.json");
const PUBLISHED_ENTRY = resolve(PACKAGE_DIR, "dist", "index.js");

interface PackageManifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function bareImports(source: string): string[] {
  const specifiers = new Set<string>();
  const pattern = /(?:^|\n)\s*(?:import|export)\b[^'"]*?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    specifiers.add(match[1]);
  }
  return [...specifiers].filter(
    (specifier) =>
      !specifier.startsWith(".") &&
      !specifier.startsWith("/") &&
      !specifier.startsWith("node:") &&
      !builtinModules.includes(specifier),
  );
}

function packageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
}

function isGuaranteed({
  manifest,
  name,
}: {
  manifest: PackageManifest;
  name: string;
}): boolean {
  if (manifest.dependencies?.[name]) {
    return true;
  }
  return (
    Boolean(manifest.peerDependencies?.[name]) &&
    manifest.peerDependenciesMeta?.[name]?.optional !== true
  );
}

describe("Published imports", () => {
  beforeAll(() => {
    if (!existsSync(PUBLISHED_ENTRY)) {
      throw new Error(
        `${PUBLISHED_ENTRY} is missing. Run "npm run build -w packages/testkit" first.`,
      );
    }
  });

  describe("Base Cases", () => {
    it("Ships a dist entry point", () => {
      expect(existsSync(PUBLISHED_ENTRY)).toBe(true);
    });
  });

  describe("Happy Paths", () => {
    it("Root entry imports only dependencies or required peers", () => {
      const manifest = JSON.parse(
        readFileSync(PACKAGE_JSON, "utf8"),
      ) as PackageManifest;
      const names = bareImports(readFileSync(PUBLISHED_ENTRY, "utf8")).map(
        packageName,
      );
      const unguaranteed = names.filter(
        (name) => !isGuaranteed({ manifest, name }),
      );
      expect(names.length).toBeGreaterThan(0);
      expect(unguaranteed).toEqual([]);
    });
  });
});
