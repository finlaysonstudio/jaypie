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
const MANIFEST = JSON.parse(
  readFileSync(resolve(PACKAGE_DIR, "package.json"), "utf8"),
) as PackageManifest;
const OPTIONAL_IMPORT = /importOptional<[^>]*>\(\s*"([^"]+)"\s*\)/g;
const ORIGINAL_SOURCE = resolve(PACKAGE_DIR, "src", "mock", "original.ts");
const PUBLISHED_ENTRIES = Object.values(MANIFEST.exports).map(
  (entry) => entry.import,
);
const STATIC_IMPORT =
  /^\s*(?:import|export)\s(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gm;

interface PackageManifest {
  dependencies?: Record<string, string>;
  exports: Record<string, { import: string; types?: string }>;
  name: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function bareImports(source: string): string[] {
  const specifiers = new Set<string>();
  for (const match of source.matchAll(STATIC_IMPORT)) {
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

function isGuaranteed(name: string): boolean {
  if (name === MANIFEST.name || MANIFEST.dependencies?.[name]) {
    return true;
  }
  return Boolean(MANIFEST.peerDependencies?.[name]) && !isOptionalPeer(name);
}

function isOptionalPeer(name: string): boolean {
  return (
    Boolean(MANIFEST.peerDependencies?.[name]) &&
    MANIFEST.peerDependenciesMeta?.[name]?.optional === true
  );
}

function packageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
}

describe("Published imports", () => {
  beforeAll(() => {
    const entry = resolve(PACKAGE_DIR, "dist", "index.js");
    if (!existsSync(entry)) {
      throw new Error(
        `${entry} is missing. Run "npm run build -w packages/testkit" first.`,
      );
    }
  });

  describe("Base Cases", () => {
    it.each(PUBLISHED_ENTRIES)("Ships %s", (entry) => {
      expect(existsSync(resolve(PACKAGE_DIR, entry))).toBe(true);
    });
  });

  describe("Happy Paths", () => {
    it.each(PUBLISHED_ENTRIES)(
      "%s statically imports only dependencies or required peers",
      (entry) => {
        const names = bareImports(
          readFileSync(resolve(PACKAGE_DIR, entry), "utf8"),
        ).map(packageName);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter((name) => !isGuaranteed(name))).toEqual([]);
      },
    );

    it("Declares every optionally loaded package as an optional peer", () => {
      const names = [
        ...readFileSync(ORIGINAL_SOURCE, "utf8").matchAll(OPTIONAL_IMPORT),
      ].map((match) => packageName(match[1]));
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((name) => !isOptionalPeer(name))).toEqual([]);
    });
  });
});
