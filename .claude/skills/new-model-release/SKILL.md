---
name: new-model-release
description: Add a newly released LLM model to the Jaypie catalog
---

# New Model Release

Steps to add a newly released provider model to `@jaypie/llm`.

## Principle

Every model id lives in exactly one file: `packages/llm/src/constants.ts`.

| Structure | Role |
|-----------|------|
| `MODEL.*` | The catalog. Aliases applications and tests reference by name. |
| `COST` | Prices by **literal id**, never by `MODEL.*` reference. |
| `PROVIDER.*.DEFAULT` | The provider's default model, referenced as `MODEL.*`. |

`MODEL` is flat for first-class providers. Anthropic, Google, OpenAI, and xAI ids are top-level keys; only `FIREWORKS` and `OPENROUTER` are nested subtrees.

The catalog is the single source of CI truth. `packages/llm/test/models.ts` derives the live capability matrix from `MODEL.*` plus each `PROVIDER.*.DEFAULT`, and the workflows shard that matrix by provider group. No id list exists anywhere else.

## Decide the shape

Two shapes, with different propagation:

| Shape | When | Consequence |
|-------|------|-------------|
| Repoint an existing alias (`OPUS: "claude-opus-5"`) | The new model supersedes the one the alias names | Every `MODEL.OPUS` consumer follows automatically, including `src/__tests__/hotModels.ts`, `test/document.ts`, and the CI matrix |
| Add a new alias (`OPUS_5: "claude-opus-5"`) | The models coexist as distinct offerings | The catalog and matrix pick it up, but `src/__tests__/hotModels.ts` enumerates aliases by hand and needs the new key added |

Prefer repointing. The catalog names tiers, not versions, so a superseding release is a value swap.

## Required edits

Both live in `packages/llm/src/constants.ts`.

1. **Catalog** — set the `MODEL.*` value to the new id.
2. **Price** — add a `COST` entry keyed by the literal id, alphabetized within the provider block. Leave the superseded id's entry in place: retired models keep their prices so historic usage records stay replayable.

Anthropic entries carry a cache-write premium and use the TTL-keyed form:

```ts
  "claude-opus-5": {
    cachedInputRead: 0.5,
    cachedInputWrite: { "1h": 10.0, "5m": 6.25 },
    input: 5.0,
    output: 25.0,
  },
```

Rates are the standard short-context text tier per million tokens. Exclude introductory, batch, flex, priority, fast-mode, and data-residency pricing, and long-prompt surcharges.

### COST invariants

| Rule | Reason |
|------|--------|
| `input > 0` | A free tier is not a price |
| `output >= input` | No provider inverts the ratio |
| `0 < cachedInputRead < input` | A cache read that costs full price is not a cache |
| Scalar `cachedInputWrite` is `0` or `>= input` | Amazon publishes a literal `0`; everyone else charges a premium |
| TTL form requires `write["5m"] > input` and `write["1h"] > write["5m"]` | Longer residency costs more |

Omitting `cachedInputWrite` means writes bill at `input`.

## Conditional edits

| Edit | Condition |
|------|-----------|
| `src/util/maxOutputTokens.ts` | The model's documented output ceiling differs from the pattern that already matches it. The table is ordered and first match wins, so a narrower pattern goes **above** the catch-all. |
| `PROVIDER.*.MODEL_MATCH_WORDS` | `determineModelProvider` cannot resolve the id. Matching is substring-on-lowercase, so most new ids resolve on an existing word. |
| `src/__tests__/hotModels.ts` | A new alias key was added, or the model should be excluded from live hot tests. |
| Adapter capability patterns | The model gates a capability differently — reasoning effort, temperature support, or a required beta header. |
| `MATRIX_EXCLUDE` in `packages/llm/test/models.ts` | The model is unlaunched, unavailable on typical keys, or too costly to exercise every run. |
| `MATRIX_EXPECT` in `packages/llm/test/models.ts` | A capability is expected to warn, skip, or fail rather than pass. |

Verify each condition rather than assuming it. For Anthropic specifically, `AnthropicAdapter` already parses the version out of a `claude-<tier>-<major>` id to gate reasoning effort, and its temperature-deprecation list is written as version ranges, so a new point release usually needs nothing.

## What never needs editing

| Location | Why |
|----------|-----|
| `packages/llm/test/models.ts` matrix construction | `catalogIds()` recursively flattens `MODEL` |
| `packages/llm/test/matrix.ts` | Selects by `APP_MODELS`, then `APP_GROUP`, then everything |
| `.github/workflows/npm-check.yml`, `npm-deploy.yml` | Shard by provider group, not by id |
| `packages/testkit` | Carries no model ids |

### Never edit the deprecated size tiers

`PROVIDER.*.MODEL.DEFAULT` / `LARGE` / `SMALL` / `TINY` are retired in 2.0. Their values are frozen.

Repointing a tier at a newer model keeps it useful, which is the opposite of the goal: a deprecated surface should decay, not track the catalog. Leaving `LARGE` on a superseded id gives callers a reason to migrate to `PROVIDER.*.DEFAULT` or a named `MODEL.*` alias. Staleness in a deprecated map is the intended state, not drift to be corrected.

The same reasoning applies to the deprecated `MODEL.GPT*` aliases and the `ALL` map.

## Release

Follow [VERSIONING.md](../VERSIONING.md): patch only, one bump per branch.

1. Bump `packages/llm/package.json`.
2. Add `packages/mcp/release-notes/llm/<version>.md` with frontmatter `version`, `date`, `summary`, then `## Changes` and `## Testing`.
3. Bump `packages/mcp` — the release notes ship inside it.
4. Update the `@jaypie/llm` range in `packages/jaypie/package.json` and bump `jaypie`.
5. Run `npm i --package-lock-only`.

Update `packages/mcp/skills/llm.md` only when its provider table or catalog bullets change. Those name aliases and provider defaults, so a value swap behind an existing alias leaves them accurate.

## Verify

Run ~green against `packages/llm`. Then confirm the resolution path end to end:

```bash
node -e 'import("./packages/llm/dist/index.js").then(m => {
  console.log(m.MODEL.OPUS, m.COST[m.MODEL.OPUS]);
})'
```

With a provider key present, exercise the seven capability cells against the live API:

```bash
APP_MODELS=<model-id> npm run test:llm:matrix
```

## Promotion

This document lives in the gitignored `var/` scratch directory. Promoting it to a first-class skill means moving it to `packages/mcp/skills/new-model-release.md` and hand-editing three curated listings, which are not generated:

- `packages/mcp/skills/skills.md` — the Categories table
- `packages/mcp/skills/development.md` — the `## Skills` alias table
- `packages/mcp/skills/agents.md` — the category lists in the AGENTS.md snippet

Then bump and rebuild `@jaypie/mcp`.
