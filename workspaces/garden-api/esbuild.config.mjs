import { build } from "esbuild";
import { builtinModules } from "module";

await build({
  entryPoints: ["index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  external: [
    "@aws-sdk/*",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  banner: {
    js: `import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);`,
  },
});
